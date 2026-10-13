namespace OpenMoney.Core.Categorie;

public enum CategoryKind
{
    Income,
    Expense,
}

public sealed record CategoryValues(string? Name, CategoryKind Kind, Guid? ParentId)
{
    public const int NameMaxLength = 60;

    public CategoryValues Normalized() => this with { Name = Name?.Trim() ?? "" };

    /// <summary>Codici degli errori di validazione di valori già normalizzati; vuoto se sono coerenti.</summary>
    /// <param name="parent">La categoria indicata da <see cref="ParentId"/>, se esiste.</param>
    /// <param name="self">La categoria che si sta modificando; null se è nuova.</param>
    /// <param name="hasChildren">Vero se la categoria che si sta modificando ha già sottocategorie.</param>
    public IReadOnlyList<string> Validate(Category? parent, Category? self = null, bool hasChildren = false)
    {
        var errors = new List<string>();
        if (Name is not { Length: > 0 and <= NameMaxLength }) errors.Add("InvalidName");
        if (!Enum.IsDefined(Kind)) errors.Add("InvalidCategoryKind");
        // I movimenti e le sottocategorie già collegati resterebbero del tipo sbagliato.
        if (self is not null && self.Kind != Kind) errors.Add("CategoryKindLocked");

        if (ParentId is not null)
        {
            // Un solo livello di sottocategorie: il padre non può essere a sua volta un figlio, né avere figli chi diventa figlio.
            if (parent is null || parent.Id == self?.Id || parent.ParentId is not null || hasChildren) errors.Add("InvalidParentCategory");
            else if (parent.Kind != Kind) errors.Add("CategoryKindMismatch");
        }

        return errors;
    }
}

/// <summary>Categoria di entrata o di uscita, eventualmente sottocategoria di un'altra dello stesso tipo.</summary>
public sealed class Category
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public CategoryKind Kind { get; private set; }
    public Guid? ParentId { get; private set; }

    public Category(CategoryValues values)
    {
        Id = Guid.CreateVersion7();
        Name = null!;
        Update(values);
    }

    // Costruttore per EF Core.
    private Category() => Name = null!;

    public void Update(CategoryValues values)
    {
        Name = values.Name!;
        Kind = values.Kind;
        ParentId = values.ParentId;
    }
}
