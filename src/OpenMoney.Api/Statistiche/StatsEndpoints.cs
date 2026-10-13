using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Categorie;
using OpenMoney.Core.Movimenti;
using OpenMoney.Core.Statistiche;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Statistiche;

public static class StatsEndpoints
{
    public sealed record BreakdownResponse(decimal Total, IReadOnlyList<CategoryShare> Shares);

    public static void MapStats(this IEndpointRouteBuilder app)
    {
        var stats = app.MapGroup("/api/stats").RequireAuthorization();

        // Entrate o uscite di un mese ripartite per categoria di primo livello.
        stats.MapGet("categories", async (int year, int month, CategoryKind kind, AppDbContext db, CancellationToken ct) =>
        {
            if (Periods.Month(year, month) is not { } period || !Enum.IsDefined(kind))
                return Results.BadRequest();

            var movementKind = kind == CategoryKind.Income ? MovementKind.Income : MovementKind.Expense;
            var totals = await TotalsByCategoryAsync(db, period, movementKind, ct);
            var shares = CategoryBreakdown.Shares(totals, await db.Categories.ToListAsync(ct));
            return Results.Ok(new BreakdownResponse(shares.Sum(s => s.Total), shares));
        });
    }

    internal static async Task<List<(Guid CategoryId, decimal Total)>> TotalsByCategoryAsync(
        AppDbContext db, (DateOnly From, DateOnly To) period, MovementKind kind, CancellationToken ct)
    {
        var totals = await db.Movements
            .Where(m => m.Date >= period.From && m.Date < period.To && m.Kind == kind && m.CategoryId != null)
            .GroupBy(m => m.CategoryId!.Value)
            .Select(g => new { CategoryId = g.Key, Total = g.Sum(m => m.Amount) })
            .ToListAsync(ct);
        return [.. totals.Select(t => (t.CategoryId, t.Total))];
    }
}
