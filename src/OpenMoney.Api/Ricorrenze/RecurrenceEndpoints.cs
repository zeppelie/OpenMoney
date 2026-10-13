using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenMoney.Api.Movimenti;
using OpenMoney.Core.Movimenti;
using OpenMoney.Core.Ricorrenze;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Ricorrenze;

public static class RecurrenceEndpoints
{
    /// <param name="Movement">Il modello dei movimenti generati; la sua data è quella della prima volta.</param>
    /// <param name="NextDate">Quando verrà generato il prossimo movimento; null se la ricorrenza è finita.</param>
    public sealed record RecurrenceResponse(
        Guid Id, MovementValues Movement, Frequency Frequency, int? Occurrences, DateOnly? EndDate, int GeneratedCount,
        DateOnly? NextDate);

    public static void MapRecurrences(this IEndpointRouteBuilder app)
    {
        var recurrences = app.MapGroup("/api/recurrences").RequireAuthorization();

        recurrences.MapGet("", async (AppDbContext db, CancellationToken ct) =>
            (await db.Recurrences.ToListAsync(ct))
            // Prima quelle con la scadenza più vicina, in fondo quelle finite.
            .OrderBy(r => r.NextDate ?? DateOnly.MaxValue)
            .Select(r => new RecurrenceResponse(
                r.Id, new(r.StartDate, r.Kind, r.Amount, r.AccountId, r.ToAccountId, r.CategoryId, r.Note),
                r.Frequency, r.Occurrences, r.EndDate, r.GeneratedCount, r.NextDate)));

        recurrences.MapPost("", async (
            RecurrenceValues values, ClaimsPrincipal principal, AppDbContext db, ScheduledMovements scheduled, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (Problems.From(await MovementEndpoints.ErrorsAsync(values.Movement, values.Validate, db, ct)) is { } problem)
                return problem;

            var recurrence = new Recurrence(values, principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            db.Recurrences.Add(recurrence);
            await db.SaveChangesAsync(ct);
            // Se la prima data è oggi o nel passato, i movimenti maturati compaiono subito.
            await scheduled.RunAsync(ct);
            return Results.Created($"/api/recurrences/{recurrence.Id}", new { recurrence.Id });
        });

        recurrences.MapPut("{id:guid}", async (Guid id, RecurrenceValues values, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Recurrences.FindAsync([id], ct) is not { } recurrence)
                return Results.NotFound();

            values = values.Normalized();
            var errors = await MovementEndpoints.ErrorsAsync(values.Movement, values.Validate, db, ct);
            if (Problems.From([.. errors, .. recurrence.ValidateUpdate(values)]) is { } problem)
                return problem;

            recurrence.Update(values);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // I movimenti già generati restano: si ferma solo ciò che doveva ancora arrivare.
        recurrences.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Recurrences.FindAsync([id], ct) is not { } recurrence)
                return Results.NotFound();

            db.Recurrences.Remove(recurrence);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
