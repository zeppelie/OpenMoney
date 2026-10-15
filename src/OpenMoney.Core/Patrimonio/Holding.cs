namespace OpenMoney.Core.Patrimonio;

/// <summary>
/// Investimento: conta nel totale ed è diviso per gestore. Previdenza: si mostra a parte perché non è prelevabile.
/// Debito (il mutuo): il valore è quanto resta da pagare e si sottrae dal patrimonio netto.
/// </summary>
public enum HoldingKind
{
    Investment,
    Pension,
    Debt,
}

/// <summary>Un gestore o macrosettore (Intesa, Azimut, Gestito da me…) che raggruppa gli investimenti.</summary>
public sealed class Portfolio
{
    public const int NameMaxLength = 60;

    public Guid Id { get; private set; }
    public string Name { get; private set; }

    public Portfolio(string name)
    {
        Id = Guid.CreateVersion7();
        Name = name;
    }

    // Costruttore per EF Core.
    private Portfolio() => Name = null!;

    public void Rename(string name) => Name = name;

    /// <summary>Il nome ripulito, o null se non è valido.</summary>
    public static string? CleanName(string? name) =>
        name?.Trim() is { Length: > 0 and <= NameMaxLength } clean ? clean : null;
}

/// <summary>Ciò che l'utente sceglie di una posizione. Solo gli investimenti hanno un gestore.</summary>
public sealed record HoldingValues(string? Name, HoldingKind Kind, Guid? PortfolioId, bool Closed)
{
    public const int NameMaxLength = 100;

    public HoldingValues Normalized() => this with
    {
        Name = Name?.Trim() ?? "",
        PortfolioId = Kind == HoldingKind.Investment ? PortfolioId : null,
    };

    /// <summary>Codici degli errori di validazione di valori già normalizzati; vuoto se sono coerenti.</summary>
    /// <param name="portfolioExists">Vero se il gestore indicato esiste.</param>
    public IReadOnlyList<string> Validate(bool portfolioExists)
    {
        var errors = new List<string>();
        if (Name is not { Length: > 0 and <= NameMaxLength }) errors.Add("InvalidName");
        if (!Enum.IsDefined(Kind)) errors.Add("InvalidHoldingKind");
        if (Kind == HoldingKind.Investment && (PortfolioId is null || !portfolioExists)) errors.Add("MissingPortfolio");
        return errors;
    }
}

/// <summary>Un prodotto di cui si rileva il valore: un fondo, un ETF, il fondo pensione, il mutuo.</summary>
public sealed class Holding
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public HoldingKind Kind { get; private set; }
    public Guid? PortfolioId { get; private set; }

    /// <summary>Una posizione chiusa resta nello storico ma non viene più proposta nelle nuove rilevazioni.</summary>
    public bool Closed { get; private set; }

    public Holding(HoldingValues values)
    {
        Id = Guid.CreateVersion7();
        Name = null!;
        Update(values);
    }

    // Costruttore per EF Core.
    private Holding() => Name = null!;

    public void Update(HoldingValues values)
    {
        Name = values.Name!;
        Kind = values.Kind;
        PortfolioId = values.PortfolioId;
        Closed = values.Closed;
    }
}
