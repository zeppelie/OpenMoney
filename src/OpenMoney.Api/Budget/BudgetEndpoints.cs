using Microsoft.EntityFrameworkCore;
using OpenMoney.Api.Statistiche;
using OpenMoney.Core.Budget;
using OpenMoney.Core.Movimenti;
using OpenMoney.Core.Statistiche;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Budget;

public static class BudgetEndpoints
{
    public sealed record BudgetAmount(decimal Amount);

    public static void MapBudgets(this IEndpointRouteBuilder app)
    {
        var budgets = app.MapGroup("/api/budgets").RequireAuthorization();

        budgets.MapGet("", async (int year, int month, AppDbContext db, CancellationToken ct) =>
        {
            if (Periods.Month(year, month) is not { } period)
                return Results.BadRequest();

            var categories = await db.Categories.ToListAsync(ct);
            var spent = CategoryBreakdown.ByTopLevel(
                await StatsEndpoints.TotalsByCategoryAsync(db, period, MovementKind.Expense, ct), categories);
            var amounts = await db.Budgets.ToDictionaryAsync(b => b.CategoryId, b => b.Amount, ct);
            return Results.Ok(BudgetStatus.From(categories, amounts, spent));
        });

        // Imposta il budget mensile della categoria, creandolo se non c'è.
        budgets.MapPut("{categoryId:guid}", async (Guid categoryId, BudgetAmount request, AppDbContext db, CancellationToken ct) =>
        {
            var category = await db.Categories.FindAsync([categoryId], ct);
            if (Problems.From(CategoryBudget.Validate(request.Amount, category)) is { } problem)
                return problem;

            if (await db.Budgets.FindAsync([categoryId], ct) is { } budget)
                budget.Update(request.Amount);
            else
                db.Budgets.Add(new(categoryId, request.Amount));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        budgets.MapDelete("{categoryId:guid}", async (Guid categoryId, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Budgets.FindAsync([categoryId], ct) is not { } budget)
                return Results.NotFound();

            db.Budgets.Remove(budget);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
