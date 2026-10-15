using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Movimenti;
using OpenMoney.Infrastructure;
using OpenMoney.Infrastructure.Movimenti;

namespace OpenMoney.Api.Movimenti;

public static class AttachmentEndpoints
{
    public sealed record AttachmentResponse(Guid Id, string FileName, string ContentType, long Size);

    public static void MapAttachments(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/movements/{movementId:guid}/attachments", async (
                Guid movementId, IFormFile file, AppDbContext db, AttachmentStore store, TimeProvider time, CancellationToken ct) =>
            {
                if (!await db.Movements.AnyAsync(m => m.Id == movementId, ct))
                    return Results.NotFound();
                if (Problems.From(Attachment.Validate(file.ContentType, file.Length)) is { } problem)
                    return problem;

                var attachment = new Attachment(movementId, file.FileName, file.ContentType, file.Length, time.GetUtcNow());
                await using (var content = file.OpenReadStream())
                    await store.SaveAsync(attachment.Id, content, ct);
                try
                {
                    db.Attachments.Add(attachment);
                    await db.SaveChangesAsync(ct);
                }
                catch
                {
                    // Senza la riga nel database il file non lo troverebbe più nessuno.
                    store.Delete(attachment.Id);
                    throw;
                }

                return Results.Created($"/api/attachments/{attachment.Id}", ToResponse(attachment));
            })
            .RequireAuthorization()
            // Il cookie di login è SameSite=Lax: un altro sito non può inviare questo modulo a nome dell'utente.
            .DisableAntiforgery();

        var attachments = app.MapGroup("/api/attachments").RequireAuthorization();

        attachments.MapGet("{id:guid}", async (Guid id, HttpContext http, AppDbContext db, AttachmentStore store, CancellationToken ct) =>
        {
            if (await db.Attachments.FindAsync([id], ct) is not { } attachment)
                return Results.NotFound();

            // Il tipo è uno di quelli ammessi al caricamento (immagini e PDF) e il browser non deve indovinarne un altro:
            // così lo mostra senza eseguire nulla. Senza nome di file si apre nella scheda invece di scaricarsi.
            http.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.Stream(store.OpenRead(id), attachment.ContentType);
        });

        attachments.MapDelete("{id:guid}", async (Guid id, AppDbContext db, AttachmentStore store, CancellationToken ct) =>
        {
            if (await db.Attachments.FindAsync([id], ct) is not { } attachment)
                return Results.NotFound();

            db.Attachments.Remove(attachment);
            await db.SaveChangesAsync(ct);
            store.Delete(id);
            return Results.NoContent();
        });
    }

    internal static AttachmentResponse ToResponse(Attachment a) => new(a.Id, a.FileName, a.ContentType, a.Size);
}
