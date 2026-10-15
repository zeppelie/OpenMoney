namespace OpenMoney.Infrastructure.Movimenti;

/// <summary>Il contenuto degli allegati, un file per allegato in una cartella (in Docker, un volume).</summary>
public sealed class AttachmentStore(string root)
{
    public async Task SaveAsync(Guid id, Stream content, CancellationToken ct)
    {
        Directory.CreateDirectory(root);
        await using var file = File.Create(PathOf(id));
        await content.CopyToAsync(file, ct);
    }

    public Stream OpenRead(Guid id) => File.OpenRead(PathOf(id));

    /// <summary>Non segnala nulla se il file non c'è già più.</summary>
    public void Delete(Guid id) => File.Delete(PathOf(id));

    // Il nome sul disco è l'identificativo, mai quello scelto dall'utente: niente percorsi pericolosi né collisioni.
    private string PathOf(Guid id) => Path.Combine(root, id.ToString("N"));
}
