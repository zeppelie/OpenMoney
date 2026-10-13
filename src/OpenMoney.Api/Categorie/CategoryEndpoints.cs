using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Categorie;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Categorie;

public static class CategoryEndpoints
{
    public sealed record CategoryResponse(Guid Id, string Name, CategoryKind Kind, Guid? ParentId);

    public static void MapCategories(this IEndpointRouteBuilder app)
    {
        var categories = app.MapGroup("/api/categories").RequireAuthorization();

        categories.MapGet("", async (AppDbContext db, CancellationToken ct) =>
            (await db.Categories.OrderBy(c => c.Name).ToListAsync(ct))
            .Select(c => new CategoryResponse(c.Id, c.Name, c.Kind, c.ParentId)));

        categories.MapPost("", async (CategoryValues values, AppDbContext db, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (Problems.From(values.Validate(await FindParentAsync(db, values, ct))) is { } problem)
                return problem;

            var category = new Category(values);
            db.Categories.Add(category);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/categories/{category.Id}", new { category.Id });
        });

        categories.MapPut("{id:guid}", async (Guid id, CategoryValues values, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Categories.FindAsync([id], ct) is not { } category)
                return Results.NotFound();

            values = values.Normalized();
            var hasChildren = await db.Categories.AnyAsync(c => c.ParentId == id, ct);
            if (Problems.From(values.Validate(await FindParentAsync(db, values, ct), category, hasChildren)) is { } problem)
                return problem;

            category.Update(values);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        categories.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Categories.FindAsync([id], ct) is not { } category)
                return Results.NotFound();
            if (await db.Categories.AnyAsync(c => c.ParentId == id, ct))
                return Problems.Of("CategoryHasChildren");
            if (await db.Movements.AnyAsync(m => m.CategoryId == id, ct) || await db.Recurrences.AnyAsync(r => r.CategoryId == id, ct))
                return Problems.Of("CategoryInUse");

            db.Categories.Remove(category);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static async Task<Category?> FindParentAsync(AppDbContext db, CategoryValues values, CancellationToken ct) =>
        values.ParentId is { } parentId ? await db.Categories.FindAsync([parentId], ct) : null;
}
