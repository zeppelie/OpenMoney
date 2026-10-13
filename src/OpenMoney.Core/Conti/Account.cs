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

/// <summary>
/// Ciò che l'utente sceglie di un conto. Il saldo non c'è: si calcola dai movimenti.
/// Una carta può avere un conto e un giorno di addebito (vedi <see cref="CardSettlement"/>).
/// </summary>
public sealed record AccountValues(
    string? Name, AccountGroup Group, decimal InitialBalance, Guid? SettlementAccountId = null, int? SettlementDay = null)
{
    public const int NameMaxLength = 60;

    /// <summary>L'addebito automatico riguarda solo le carte: per gli altri gruppi si scarta.</summary>
    public AccountValues Normalized() => this with
    {
        Name = Name?.Trim() ?? "",
        SettlementAccountId = Group == AccountGroup.Card ? SettlementAccountId : null,
        SettlementDay = Group == AccountGroup.Card ? SettlementDay : null,
    };

    /// <summary>Codici degli errori di validazione di valori già normalizzati; vuoto se sono coerenti.</summary>
    public IReadOnlyList<string> Validate()
    {
        var errors = new List<string>();
        if (Name is not { Length: > 0 and <= NameMaxLength }) errors.Add("InvalidName");
        if (!Enum.IsDefined(Group)) errors.Add("InvalidAccountGroup");
        if (!Money.IsValid(InitialBalance)) errors.Add("InvalidAmount");
        // Conto e giorno di addebito vanno insieme: uno senza l'altro non dice quando o da dove addebitare.
        if ((SettlementAccountId is null) != (SettlementDay is null)
            || SettlementDay is < CardSettlement.MinDay or > CardSettlement.MaxDay) errors.Add("InvalidSettlement");
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
    public Guid? SettlementAccountId { get; private set; }
    public int? SettlementDay { get; private set; }

    /// <summary>Chiusura dell'ultimo estratto della carta già addebitato; null senza addebito automatico.</summary>
    public DateOnly? SettledThrough { get; private set; }

    public Account(AccountValues values, DateOnly today)
    {
        Id = Guid.CreateVersion7();
        Name = null!;
        Update(values, today);
    }

    // Costruttore per EF Core.
    private Account() => Name = null!;

    public void Update(AccountValues values, DateOnly today)
    {
        Name = values.Name!;
        Group = values.Group;
        InitialBalance = values.InitialBalance;
        SettlementAccountId = values.SettlementAccountId;
        SettlementDay = values.SettlementDay;
        // Attivando l'addebito si parte dagli estratti ancora da pagare; cambiando solo conto o giorno si prosegue.
        SettledThrough = values.SettlementDay is { } day ? SettledThrough ?? CardSettlement.LastPaidStatement(day, today) : null;
    }

    /// <summary>Segna come addebitato l'estratto che si chiude a <paramref name="statementEnd"/>.</summary>
    public void MarkSettled(DateOnly statementEnd) => SettledThrough = statementEnd;
}
