namespace OpenMoney.Core.Patrimonio;

/// <summary>
/// Una posizione in una rilevazione. <see cref="Invested"/> è quanto vi si è messo finora (cresce con i versamenti
/// di un piano d'accumulo); può mancare, per esempio nello storico più vecchio o per previdenza e mutuo.
/// </summary>
public sealed record SnapshotHolding(Guid HoldingId, decimal? Invested, decimal Value);

/// <summary>
/// Il saldo di un conto alla data della rilevazione. Con <see cref="AccountId"/> è un conto di OpenMoney (il saldo
/// viene proposto dai movimenti); senza, è un conto tenuto solo qui (es. Satispay) e il nome basta.
/// </summary>
public sealed record SnapshotAccount(Guid? AccountId, string Name, decimal Balance)
{
    public const int NameMaxLength = 60;
}

public sealed record SnapshotValues(
    DateOnly Date, IReadOnlyList<SnapshotHolding> Holdings, IReadOnlyList<SnapshotAccount> Accounts, string? Note)
{
    public const int NoteMaxLength = 500;

    private static readonly DateOnly EarliestDate = new(1990, 1, 1);
    private static readonly DateOnly LatestDate = new(2100, 12, 31);

    public SnapshotValues Normalized() => this with
    {
        Accounts = [.. Accounts.Select(a => a with { Name = a.Name?.Trim() ?? "" })],
        Note = string.IsNullOrWhiteSpace(Note) ? null : Note.Trim(),
    };

    /// <summary>Codici degli errori di validazione di valori già normalizzati; vuoto se sono coerenti.</summary>
    public IReadOnlyList<string> Validate()
    {
        var errors = new List<string>();
        if (Date < EarliestDate || Date > LatestDate) errors.Add("InvalidDate");
        if (Holdings.Any(h => !Money.IsValid(h.Value) || h.Value < 0 || h.Invested is { } i && (!Money.IsValid(i) || i < 0))
            || Accounts.Any(a => !Money.IsValid(a.Balance)))
            errors.Add("InvalidAmount");
        if (Holdings.Select(h => h.HoldingId).Distinct().Count() < Holdings.Count) errors.Add("DuplicateHolding");
        if (Accounts.Any(a => a.Name is not { Length: > 0 and <= SnapshotAccount.NameMaxLength })) errors.Add("InvalidName");
        if (Note?.Length > NoteMaxLength) errors.Add("NoteTooLong");
        return errors;
    }

    /// <summary>
    /// La rilevazione da proporre: le posizioni aperte con i valori della volta prima (zero per le nuove), i conti di
    /// OpenMoney con il saldo calcolato alla data e i conti tenuti solo qui con il saldo della volta prima.
    /// </summary>
    /// <param name="previous">La rilevazione più recente prima di <paramref name="date"/>, se c'è.</param>
    /// <param name="openHoldings">Le posizioni non chiuse.</param>
    /// <param name="appAccounts">I conti di OpenMoney con il saldo alla data.</param>
    public static SnapshotValues Draft(
        DateOnly date, Snapshot? previous, IEnumerable<Holding> openHoldings,
        IEnumerable<(Guid Id, string Name, decimal Balance)> appAccounts)
    {
        var last = previous?.Holdings.ToDictionary(h => h.HoldingId) ?? [];
        var holdings = openHoldings
            .Select(h => last.TryGetValue(h.Id, out var before) ? before : new SnapshotHolding(h.Id, null, 0))
            .ToList();
        var accounts = appAccounts
            .Select(a => new SnapshotAccount(a.Id, a.Name, a.Balance))
            .Concat(previous?.Accounts.Where(a => a.AccountId is null) ?? [])
            .ToList();

        return new(date, holdings, accounts, null);
    }
}

/// <summary>La fotografia del patrimonio a una data: il valore di ogni posizione e il saldo di ogni conto.</summary>
public sealed class Snapshot
{
    public Guid Id { get; private set; }
    public DateOnly Date { get; private set; }
    public string? Note { get; private set; }
    public List<SnapshotHolding> Holdings { get; private set; } = [];
    public List<SnapshotAccount> Accounts { get; private set; } = [];

    public Snapshot(SnapshotValues values)
    {
        Id = Guid.CreateVersion7();
        Replace(values);
    }

    // Costruttore per EF Core.
    private Snapshot()
    {
    }

    public void Replace(SnapshotValues values)
    {
        Date = values.Date;
        Note = values.Note;
        Holdings = [.. values.Holdings];
        Accounts = [.. values.Accounts];
    }

    /// <summary>Collega a un conto di OpenMoney le righe tenute solo qui con quel nome (senza badare alle maiuscole).</summary>
    public void LinkAccount(string name, Guid accountId) =>
        Accounts = [.. Accounts.Select(a => a.AccountId is null && SameName(a.Name, name) ? a with { AccountId = accountId } : a)];

    /// <summary>
    /// I conti tenuti solo nelle rilevazioni, ciascuno con il saldo dell'ultima rilevazione in cui compare: è il saldo
    /// da cui partire quando diventano conti di OpenMoney.
    /// </summary>
    public static IReadOnlyDictionary<string, decimal> LatestUnlinkedBalances(IEnumerable<Snapshot> snapshots)
    {
        var latest = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        foreach (var snapshot in snapshots.OrderBy(s => s.Date))
            foreach (var account in snapshot.Accounts.Where(a => a.AccountId is null))
                latest[account.Name.Trim()] = account.Balance;
        return latest;
    }

    private static bool SameName(string a, string b) => string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);
}
