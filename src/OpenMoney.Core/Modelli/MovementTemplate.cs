using OpenMoney.Core.Categorie;
using OpenMoney.Core.Movimenti;

namespace OpenMoney.Core.Modelli;

/// <summary>
/// Un movimento che si inserisce spesso (la spesa al solito supermercato, il pieno): tutto tranne la data,
/// e l'importo è facoltativo perché spesso cambia ogni volta.
/// </summary>
public sealed record TemplateValues(
    string? Name, MovementKind Kind, decimal? Amount, Guid AccountId, Guid? ToAccountId, Guid? CategoryId, string? Note)
{
    public const int NameMaxLength = 60;

    // Data e importo di comodo per validare il resto con le regole di un movimento vero: la data non viene
    // controllata qui, l'importo sì ma solo se c'è.
    private static readonly DateOnly AnyValidDate = new(2000, 1, 1);
    private const decimal AnyValidAmount = 1m;

    public TemplateValues Normalized()
    {
        var movement = AsMovement().Normalized();
        return this with { Name = Name?.Trim() ?? "", ToAccountId = movement.ToAccountId, CategoryId = movement.CategoryId, Note = movement.Note };
    }

    /// <summary>Gli stessi dati come movimento, con data e importo di comodo: per riusarne i controlli.</summary>
    public MovementValues AsMovement() =>
        new(AnyValidDate, Kind, Amount ?? AnyValidAmount, AccountId, ToAccountId, CategoryId, Note);

    /// <summary>Codici degli errori di validazione di valori già normalizzati; vuoto se sono coerenti.</summary>
    /// <param name="categoryKind">Tipo della categoria indicata, se esiste.</param>
    public IReadOnlyList<string> Validate(CategoryKind? categoryKind)
    {
        var errors = new List<string>();
        if (Name is not { Length: > 0 and <= NameMaxLength }) errors.Add("InvalidName");
        errors.AddRange(AsMovement().Validate(categoryKind));
        return errors;
    }
}

public sealed class MovementTemplate
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public MovementKind Kind { get; private set; }
    public decimal? Amount { get; private set; }
    public Guid AccountId { get; private set; }
    public Guid? ToAccountId { get; private set; }
    public Guid? CategoryId { get; private set; }
    public string? Note { get; private set; }

    public MovementTemplate(TemplateValues values)
    {
        Id = Guid.CreateVersion7();
        Name = values.Name!;
        Kind = values.Kind;
        Amount = values.Amount;
        AccountId = values.AccountId;
        ToAccountId = values.ToAccountId;
        CategoryId = values.CategoryId;
        Note = values.Note;
    }

    // Costruttore per EF Core.
    private MovementTemplate() => Name = null!;
}
