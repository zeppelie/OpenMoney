namespace OpenMoney.Core.Conti;

public enum AccountGroup
{
    Cash,
    Bank,
    Card,
    Savings,
    Investments,
    Loan,
}

/// <summary>Ciò che l'utente sceglie di un conto. Il saldo non c'è: si calcola dai movimenti.</summary>
public sealed record AccountValues(string? Name, AccountGroup Group, decimal InitialBalance)
{
    public const int NameMaxLength = 60;

    public AccountValues Normalized() => this with { Name = Name?.Trim() ?? "" };

    /// <summary>Codici degli errori di validazione di valori già normalizzati; vuoto se sono coerenti.</summary>
    public IReadOnlyList<string> Validate()
    {
        var errors = new List<string>();
        if (Name is not { Length: > 0 and <= NameMaxLength }) errors.Add("InvalidName");
        if (!Enum.IsDefined(Group)) errors.Add("InvalidAccountGroup");
        if (!Money.IsValid(InitialBalance)) errors.Add("InvalidAmount");
        return errors;
    }
}

/// <summary>Un conto della famiglia: contanti, conto in banca, carta, risparmi, investimenti o prestito.</summary>
public sealed class Account
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public AccountGroup Group { get; private set; }
    public decimal InitialBalance { get; private set; }

    public Account(AccountValues values)
    {
        Id = Guid.CreateVersion7();
        Name = null!;
        Update(values);
    }

    // Costruttore per EF Core.
    private Account() => Name = null!;

    public void Update(AccountValues values)
    {
        Name = values.Name!;
        Group = values.Group;
        InitialBalance = values.InitialBalance;
    }
}
