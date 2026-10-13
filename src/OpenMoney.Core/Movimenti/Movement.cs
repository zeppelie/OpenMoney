using OpenMoney.Core.Categorie;

namespace OpenMoney.Core.Movimenti;

public enum MovementKind
{
    Income,
    Expense,
    Transfer,
}

/// <summary>
/// Ciò che l'utente inserisce di un movimento. L'importo è sempre positivo: il segno lo dà il tipo.
/// Entrate e uscite hanno una categoria; un trasferimento ha un conto di destinazione.
/// </summary>
public sealed record MovementValues(
    DateOnly Date, MovementKind Kind, decimal Amount, Guid AccountId, Guid? ToAccountId, Guid? CategoryId, string? Note)
{
    public const int NoteMaxLength = 200;

    private static readonly DateOnly EarliestDate = new(1990, 1, 1);
    private static readonly DateOnly LatestDate = new(2100, 12, 31);

    /// <summary>Toglie ciò che non riguarda il tipo scelto: chi cambia tipo nel modulo può lasciare valori del precedente.</summary>
    public MovementValues Normalized() => this with
    {
        ToAccountId = Kind == MovementKind.Transfer ? ToAccountId : null,
        CategoryId = Kind == MovementKind.Transfer ? null : CategoryId,
        Note = string.IsNullOrWhiteSpace(Note) ? null : Note.Trim(),
    };

    /// <summary>Codici degli errori di validazione di valori già normalizzati; vuoto se sono coerenti.</summary>
    /// <param name="categoryKind">Tipo della categoria indicata da <see cref="CategoryId"/>, se esiste.</param>
    public IReadOnlyList<string> Validate(CategoryKind? categoryKind)
    {
        var errors = new List<string>();
        if (Date < EarliestDate || Date > LatestDate) errors.Add("InvalidDate");
        if (Amount <= 0 || !Money.IsValid(Amount)) errors.Add("InvalidAmount");
        if (Note?.Length > NoteMaxLength) errors.Add("NoteTooLong");

        switch (Kind)
        {
            case MovementKind.Transfer:
                if (ToAccountId is null) errors.Add("MissingToAccount");
                else if (ToAccountId == AccountId) errors.Add("SameAccount");
                break;
            case MovementKind.Income or MovementKind.Expense:
                if (categoryKind is null) errors.Add("MissingCategory");
                else if (categoryKind != (Kind == MovementKind.Income ? CategoryKind.Income : CategoryKind.Expense)) errors.Add("CategoryKindMismatch");
                break;
            default:
                errors.Add("InvalidMovementKind");
                break;
        }

        return errors;
    }
}

/// <summary>Un'entrata, un'uscita o un trasferimento tra due conti.</summary>
public sealed class Movement
{
    public Guid Id { get; private set; }
    public DateOnly Date { get; private set; }
    public MovementKind Kind { get; private set; }
    public decimal Amount { get; private set; }
    public Guid AccountId { get; private set; }
    public Guid? ToAccountId { get; private set; }
    public Guid? CategoryId { get; private set; }
    public string? Note { get; private set; }

    /// <summary>Chi l'ha inserito; null se l'ha generato l'app (addebito di una carta) o se quell'utente non esiste più.</summary>
    public string? AuthorId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public Movement(MovementValues values, string? authorId, DateTimeOffset createdAt)
    {
        Id = Guid.CreateVersion7();
        AuthorId = authorId;
        CreatedAt = createdAt;
        Update(values);
    }

    // Costruttore per EF Core.
    private Movement()
    {
    }

    public void Update(MovementValues values)
    {
        Date = values.Date;
        Kind = values.Kind;
        Amount = values.Amount;
        AccountId = values.AccountId;
        ToAccountId = values.ToAccountId;
        CategoryId = values.CategoryId;
        Note = values.Note;
    }
}
