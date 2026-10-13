using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Categorie;
using OpenMoney.Core.Movimenti;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Movimenti;

public static class MovementEndpoints
{
    private const int FirstYear = 1990;
    private const int LastYear = 2100;

    /// <param name="Author">Nome di chi ha inserito il movimento; null se quell'utente non esiste più.</param>
    public sealed record MovementResponse(
        Guid Id, DateOnly Date, MovementKind Kind, decimal Amount, Guid AccountId, Guid? ToAccountId, Guid? CategoryId,
        string? Note, string? Author);

    public sealed record DayResponse(DateOnly Date, decimal Income, decimal Expense, IReadOnlyList<MovementResponse> Movements);

    public sealed record MonthResponse(decimal Income, decimal Expense, IReadOnlyList<DayResponse> Days);

    public static void MapMovements(this IEndpointRouteBuilder app)
    {
        var movements = app.MapGroup("/api/movements").RequireAuthorization();

        movements.MapGet("", async (int year, int month, AppDbContext db, CancellationToken ct) =>
        {
            if (year is < FirstYear or > LastYear || month is < 1 or > 12)
                return Results.BadRequest();

            var from = new DateOnly(year, month, 1);
            var to = from.AddMonths(1);
            var ledger = MonthLedger.From(await db.Movements.Where(m => m.Date >= from && m.Date < to).ToListAsync(ct));
            var authors = await db.Users.ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? u.Email, ct);

            return Results.Ok(new MonthResponse(ledger.Income, ledger.Expense,
            [
                .. ledger.Days.Select(day => new DayResponse(day.Date, day.Income, day.Expense,
                    [.. day.Movements.Select(m => ToResponse(m, authors))])),
            ]));
        });

        movements.MapGet("years/{year:int}", async (int year, AppDbContext db, CancellationToken ct) =>
        {
            if (year is < FirstYear or > LastYear)
                return Results.BadRequest();

            var from = new DateOnly(year, 1, 1);
            var to = from.AddYears(1);
            var totals = await db.Movements
                .Where(m => m.Date >= from && m.Date < to)
                .GroupBy(m => new { m.Date.Month, m.Kind })
                .Select(g => new { g.Key.Month, g.Key.Kind, Total = g.Sum(m => m.Amount) })
                .ToListAsync(ct);

            return Results.Ok(MonthTotals.ForYear(totals.Select(t => (t.Month, t.Kind, t.Total))));
        });

        movements.MapPost("", async (MovementValues values, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (await ProblemAsync(values, db, ct) is { } problem)
                return problem;

            var movement = new Movement(values, principal.FindFirstValue(ClaimTypes.NameIdentifier)!, DateTimeOffset.UtcNow);
            db.Movements.Add(movement);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/movements/{movement.Id}", new { movement.Id });
        });

        movements.MapPut("{id:guid}", async (Guid id, MovementValues values, AppDbContext db, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (await ProblemAsync(values, db, ct) is { } problem)
                return problem;
            if (await db.Movements.FindAsync([id], ct) is not { } movement)
                return Results.NotFound();

            movement.Update(values);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        movements.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Movements.FindAsync([id], ct) is not { } movement)
                return Results.NotFound();

            db.Movements.Remove(movement);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static async Task<IResult?> ProblemAsync(MovementValues values, AppDbContext db, CancellationToken ct)
    {
        Guid[] accountIds = values.ToAccountId is { } to ? [values.AccountId, to] : [values.AccountId];
        var knownAccounts = await db.Accounts.CountAsync(a => accountIds.Contains(a.Id), ct);
        CategoryKind? categoryKind = values.CategoryId is { } categoryId
            ? (await db.Categories.FindAsync([categoryId], ct))?.Kind
            : null;

        var errors = values.Validate(categoryKind);
        return Problems.From(knownAccounts < accountIds.Distinct().Count() ? [.. errors, "UnknownAccount"] : errors);
    }

    private static MovementResponse ToResponse(Movement m, Dictionary<string, string?> authors) =>
        new(m.Id, m.Date, m.Kind, m.Amount, m.AccountId, m.ToAccountId, m.CategoryId, m.Note,
            m.AuthorId is { } authorId ? authors.GetValueOrDefault(authorId) : null);
}
