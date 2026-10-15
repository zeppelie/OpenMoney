using Microsoft.EntityFrameworkCore;
using OpenMoney.Api.Movimenti;
using OpenMoney.Core.Modelli;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Modelli;

public static class TemplateEndpoints
{
    public static void MapTemplates(this IEndpointRouteBuilder app)
    {
        var templates = app.MapGroup("/api/templates").RequireAuthorization();

        templates.MapGet("", async (AppDbContext db, CancellationToken ct) =>
            await db.Templates.OrderBy(t => t.Name).ToListAsync(ct));

        templates.MapPost("", async (TemplateValues values, AppDbContext db, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (Problems.From(await MovementEndpoints.ErrorsAsync(values.AsMovement(), values.Validate, db, ct)) is { } problem)
                return problem;

            var template = new MovementTemplate(values);
            db.Templates.Add(template);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/templates/{template.Id}", new { template.Id });
        });

        templates.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Templates.FindAsync([id], ct) is not { } template)
                return Results.NotFound();

            db.Templates.Remove(template);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
