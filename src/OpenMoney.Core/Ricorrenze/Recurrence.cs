using OpenMoney.Core.Categorie;
using OpenMoney.Core.Movimenti;

namespace OpenMoney.Core.Ricorrenze;

public enum Frequency
{
    Weekly,
    Monthly,
    Yearly,
}

/// <summary>
/// Un movimento che si ripete: <see cref="Movement"/> è il modello e la sua data è quella della prima volta.
/// Con <see cref="Occurrences"/> si ripete un numero fisso di volte (le rate), con <see cref="EndDate"/> fino a
/// una data; senza nessuno dei due, finché non la si elimina.
/// </summary>
public sealed record RecurrenceValues(MovementValues Movement, Frequency Frequency, int? Occurrences, DateOnly? EndDate)
{
    public const int MaxOccurrences = 600;

    public RecurrenceValues Normalized() => this with { Movement = Movement.Normalized() };

    /// <summary>Codici degli errori di validazione di valori già normalizzati; vuoto se sono coerenti.</summary>
    /// <param name="categoryKind">Tipo della categoria del movimento, se esiste.</param>
    public IReadOnlyList<string> Validate(CategoryKind? categoryKind)
    {
        var errors = Movement.Validate(categoryKind).ToList();
        if (!Enum.IsDefined(Frequency)) errors.Add("InvalidFrequency");
        if (Occurrences is < 1 or > MaxOccurrences) errors.Add("InvalidOccurrences");
        if (EndDate < Movement.Date) errors.Add("InvalidEndDate");
        return errors;
    }
}

/// <summary>Ricorrenza o piano di rate: sa quali movimenti ha già generato e quando tocca al prossimo.</summary>
public sealed class Recurrence
{
    public Guid Id { get; private set; }
    public DateOnly StartDate { get; private set; }
    public Frequency Frequency { get; private set; }
    public int? Occurrences { get; private set; }
    public DateOnly? EndDate { get; private set; }

    /// <summary>Quanti movimenti sono già stati generati.</summary>
    public int GeneratedCount { get; private set; }

    public MovementKind Kind { get; private set; }
    public decimal Amount { get; private set; }
    public Guid AccountId { get; private set; }
    public Guid? ToAccountId { get; private set; }
    public Guid? CategoryId { get; private set; }
    public string? Note { get; private set; }

    /// <summary>Chi l'ha creata: risulta autore dei movimenti generati. Null se quell'utente non esiste più.</summary>
    public string? AuthorId { get; private set; }

    public Recurrence(RecurrenceValues values, string authorId)
    {
        Id = Guid.CreateVersion7();
        AuthorId = authorId;
        StartDate = values.Movement.Date;
        Frequency = values.Frequency;
        Apply(values);
    }

    // Costruttore per EF Core.
    private Recurrence()
    {
    }

    /// <summary>Data del prossimo movimento da generare; null se la ricorrenza è finita.</summary>
    public DateOnly? NextDate
    {
        get
        {
            if (GeneratedCount >= Occurrences)
                return null;

            // Si parte sempre dalla prima data: così una ricorrenza del 31 torna al 31 dopo i mesi più corti.
            var next = Frequency switch
            {
                Frequency.Weekly => StartDate.AddDays(7 * GeneratedCount),
                Frequency.Monthly => StartDate.AddMonths(GeneratedCount),
                _ => StartDate.AddYears(GeneratedCount),
            };
            return next > EndDate ? null : next;
        }
    }

    /// <summary>I movimenti maturati fino a <paramref name="today"/> compreso; li segna come generati.</summary>
    public IReadOnlyList<MovementValues> TakeDue(DateOnly today)
    {
        var due = new List<MovementValues>();
        while (NextDate is { } date && date <= today)
        {
            due.Add(new(date, Kind, Amount, AccountId, ToAccountId, CategoryId, Note));
            GeneratedCount++;
        }

        return due;
    }

    /// <summary>
    /// Codici degli errori che impediscono la modifica; vuoto se si può fare. Prima data e frequenza non si
    /// cambiano: i movimenti già generati non corrisponderebbero più al calendario della ricorrenza.
    /// </summary>
    public IReadOnlyList<string> ValidateUpdate(RecurrenceValues values) =>
        values.Movement.Date != StartDate || values.Frequency != Frequency ? ["RecurrenceScheduleLocked"] : [];

    /// <summary>Cambia modello e termine: vale per i movimenti ancora da generare.</summary>
    public void Update(RecurrenceValues values) => Apply(values);

    private void Apply(RecurrenceValues values)
    {
        Occurrences = values.Occurrences;
        EndDate = values.EndDate;
        Kind = values.Movement.Kind;
        Amount = values.Movement.Amount;
        AccountId = values.Movement.AccountId;
        ToAccountId = values.Movement.ToAccountId;
        CategoryId = values.Movement.CategoryId;
        Note = values.Movement.Note;
    }
}
