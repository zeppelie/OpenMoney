namespace OpenMoney.Core.Movimenti;

/// <summary>Un file allegato a un movimento, di solito la foto dello scontrino. Il contenuto sta fuori dal database.</summary>
public sealed class Attachment
{
    public const long MaxSize = 10 * 1024 * 1024;
    public const int FileNameMaxLength = 200;

    // Solo immagini e PDF: niente che il browser possa eseguire quando l'allegato viene aperto (HTML, SVG).
    private static readonly HashSet<string> AllowedContentTypes =
        ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

    public Guid Id { get; private set; }
    public Guid MovementId { get; private set; }
    public string FileName { get; private set; }
    public string ContentType { get; private set; }
    public long Size { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    public Attachment(Guid movementId, string? fileName, string contentType, long size, DateTimeOffset createdAt)
    {
        Id = Guid.CreateVersion7();
        MovementId = movementId;
        FileName = CleanFileName(fileName);
        ContentType = contentType;
        Size = size;
        CreatedAt = createdAt;
    }

    // Costruttore per EF Core.
    private Attachment()
    {
        FileName = null!;
        ContentType = null!;
    }

    /// <summary>Codici degli errori che impediscono di allegare il file; vuoto se va bene.</summary>
    public static IReadOnlyList<string> Validate(string? contentType, long size)
    {
        var errors = new List<string>();
        if (contentType is null || !AllowedContentTypes.Contains(contentType)) errors.Add("UnsupportedFileType");
        if (size <= 0) errors.Add("EmptyFile");
        else if (size > MaxSize) errors.Add("FileTooLarge");
        return errors;
    }

    /// <summary>Solo il nome, senza cartelle (alcuni browser mandano il percorso intero), e di lunghezza ragionevole.</summary>
    private static string CleanFileName(string? fileName)
    {
        var name = Path.GetFileName(fileName?.Replace('\\', '/') ?? "").Trim();
        if (name.Length == 0)
            return "allegato";
        return name.Length <= FileNameMaxLength ? name : name[^FileNameMaxLength..];
    }
}
