namespace OpenMoney.Core.Patrimonio;

/// <summary>Una posizione in una rilevazione, con il guadagno se si sa quanto vi si è messo.</summary>
public sealed record HoldingSummary(Guid HoldingId, string Name, decimal? Invested, decimal Value)
{
    public decimal? Gain => Value - Invested;
    public decimal? GainPercent => Percent(Invested, Value);

    /// <summary>Guadagno in percentuale con due decimali; null se l'investito non è noto o è zero.</summary>
    internal static decimal? Percent(decimal? invested, decimal value) =>
        invested is > 0 ? Math.Round((value - invested.Value) / invested.Value * 100, 2, MidpointRounding.AwayFromZero) : null;
}

/// <summary>Un gestore con le sue posizioni. L'investito c'è solo se è noto per tutte.</summary>
public sealed record PortfolioSummary(Guid PortfolioId, string Name, IReadOnlyList<HoldingSummary> Holdings)
{
    public decimal Value => Holdings.Sum(h => h.Value);
    public decimal? Invested => Holdings.All(h => h.Invested is not null) ? Holdings.Sum(h => h.Invested!.Value) : null;
    public decimal? Gain => Value - Invested;
    public decimal? GainPercent => HoldingSummary.Percent(Invested, Value);
}

/// <summary>
/// Una rilevazione letta come nel foglio "Generale": il gestito per gestore più i conti fa il totale; la previdenza
/// sta a parte; il netto aggiunge la previdenza e toglie i debiti (il mutuo residuo).
/// </summary>
public sealed record SnapshotSummary(
    Guid Id, DateOnly Date, string? Note, IReadOnlyList<PortfolioSummary> Portfolios, IReadOnlyList<SnapshotAccount> Accounts,
    IReadOnlyList<HoldingSummary> Pension, IReadOnlyList<HoldingSummary> Debts)
{
    public decimal Managed => Portfolios.Sum(p => p.Value);
    public decimal Liquidity => Accounts.Sum(a => a.Balance);
    public decimal Total => Managed + Liquidity;
    public decimal PensionTotal => Pension.Sum(h => h.Value);
    public decimal DebtTotal => Debts.Sum(h => h.Value);
    public decimal NetWorth => Total + PensionTotal - DebtTotal;

    public static SnapshotSummary From(Snapshot snapshot, IReadOnlyDictionary<Guid, Holding> holdings, IReadOnlyDictionary<Guid, Portfolio> portfolios)
    {
        var lines = snapshot.Holdings
            .Where(line => holdings.ContainsKey(line.HoldingId))
            .Select(line => (Holding: holdings[line.HoldingId], Summary: new HoldingSummary(line.HoldingId, holdings[line.HoldingId].Name, line.Invested, line.Value)))
            .ToList();

        IReadOnlyList<HoldingSummary> OfKind(HoldingKind kind) =>
            [.. lines.Where(l => l.Holding.Kind == kind).Select(l => l.Summary).OrderBy(h => h.Name)];

        var byPortfolio = lines
            .Where(l => l.Holding is { Kind: HoldingKind.Investment, PortfolioId: { } id } && portfolios.ContainsKey(id))
            .GroupBy(l => l.Holding.PortfolioId!.Value)
            .Select(g => new PortfolioSummary(g.Key, portfolios[g.Key].Name, [.. g.Select(l => l.Summary).OrderBy(h => h.Name)]))
            .OrderBy(p => p.Name)
            .ToList();

        return new(snapshot.Id, snapshot.Date, snapshot.Note, byPortfolio, [.. snapshot.Accounts.OrderBy(a => a.Name)],
            OfKind(HoldingKind.Pension), OfKind(HoldingKind.Debt));
    }
}
