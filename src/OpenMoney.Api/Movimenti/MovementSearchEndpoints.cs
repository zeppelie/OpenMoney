using System.Text;
using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Movimenti;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Movimenti;

public static class MovementSearchEndpoints
{
    // Oltre, la pagina dice di restringere la ricerca: l'esportazione invece non ha limite.
    private const int MaxResults = 500;

    /// <summary>Filtri della ricerca: valgono tutti insieme, quelli assenti non filtrano.</summary>
    /// <param name="Text">Testo cercato nella nota, senza distinguere maiuscole e minuscole.</param>
    /// <param name="AccountId">Il conto del movimento, o uno dei due di un trasferimento.</param>
    /// <param name="CategoryId">La categoria; se è di primo livello comprende le sue sottocategorie.</param>
    public sealed record Criteria(string? Text, DateOnly? From, DateOnly? To, Guid? AccountId, Guid? CategoryId, MovementKind? Kind);

    /// <param name="Truncated">Vero se i movimenti trovati sono più di quelli mostrati.</param>
    public sealed record SearchResponse(MovementEndpoints.MonthResponse Ledger, bool Truncated);

    public static void MapMovementSearch(this IEndpointRouteBuilder app)
    {
        var movements = app.MapGroup("/api/movements").RequireAuthorization();

        movements.MapGet("search", async ([AsParameters] Criteria criteria, AppDbContext db, CancellationToken ct) =>
        {
            var found = await Filter(db, criteria)
                .OrderByDescending(m => m.Date).ThenByDescending(m => m.CreatedAt)
                .Take(MaxResults + 1)
                .ToListAsync(ct);
            var ledger = await MovementEndpoints.LedgerResponseAsync(found.Take(MaxResults), db, ct);
            return new SearchResponse(ledger, Truncated: found.Count > MaxResults);
        });

        movements.MapGet("export", async ([AsParameters] Criteria criteria, AppDbContext db, CancellationToken ct) =>
        {
            var found = await Filter(db, criteria).OrderBy(m => m.Date).ThenBy(m => m.CreatedAt).ToListAsync(ct);
            var accounts = await db.Accounts.ToDictionaryAsync(a => a.Id, a => a.Name, ct);
            var categories = await db.Categories.ToDictionaryAsync(c => c.Id, ct);
            var authors = await db.Users.ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.Email, ct);

            var rows = found.Select(m =>
            {
                var category = m.CategoryId is { } id ? categories[id] : null;
                var parent = category?.ParentId is { } parentId ? categories[parentId] : null;
                return new ExportRow(
                    m.Date, m.Kind, m.Amount, accounts[m.AccountId],
                    m.ToAccountId is { } to ? accounts[to] : null,
                    (parent ?? category)?.Name,
                    parent is null ? null : category!.Name,
                    m.Note,
                    m.AuthorId is { } authorId ? authors.GetValueOrDefault(authorId) : null);
            });

            // Con il BOM Excel riconosce l'UTF-8 e non storpia le lettere accentate.
            var csv = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(MovementCsv.Write(rows))).ToArray();
            return Results.File(csv, "text/csv; charset=utf-8", "movimenti.csv");
        });
    }

    private static IQueryable<Movement> Filter(AppDbContext db, Criteria criteria)
    {
        var movements = db.Movements.AsQueryable();

        if (criteria.Text?.Trim().ToLower() is { Length: > 0 } text)
            movements = movements.Where(m => m.Note != null && m.Note.ToLower().Contains(text));
        if (criteria.From is { } from)
            movements = movements.Where(m => m.Date >= from);
        if (criteria.To is { } to)
            movements = movements.Where(m => m.Date <= to);
        if (criteria.Kind is { } kind)
            movements = movements.Where(m => m.Kind == kind);
        if (criteria.AccountId is { } accountId)
            movements = movements.Where(m => m.AccountId == accountId || m.ToAccountId == accountId);
        if (criteria.CategoryId is { } categoryId)
            movements = movements.Where(m =>
                m.CategoryId == categoryId || db.Categories.Any(c => c.Id == m.CategoryId && c.ParentId == categoryId));

        return movements;
    }
}
