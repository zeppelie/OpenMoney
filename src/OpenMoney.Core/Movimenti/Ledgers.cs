namespace OpenMoney.Core.Movimenti;

/// <summary>I movimenti di un giorno, dal più recente, con i totali del giorno.</summary>
public sealed record DayLedger(DateOnly Date, decimal Income, decimal Expense, IReadOnlyList<Movement> Movements);

/// <summary>
/// I movimenti di un periodo raggruppati per giorno, dal più recente. I trasferimenti si vedono
/// ma non contano nei totali: spostano denaro tra conti della famiglia, non lo fanno entrare o uscire.
/// </summary>
public sealed record MonthLedger(decimal Income, decimal Expense, IReadOnlyList<DayLedger> Days)
{
    public static MonthLedger From(IEnumerable<Movement> movements)
    {
        var days = movements
            .GroupBy(m => m.Date)
            .OrderByDescending(day => day.Key)
            .Select(day => new DayLedger(
                day.Key,
                Total(day, MovementKind.Income),
                Total(day, MovementKind.Expense),
                [.. day.OrderByDescending(m => m.CreatedAt)]))
            .ToList();

        return new(days.Sum(d => d.Income), days.Sum(d => d.Expense), days);
    }

    private static decimal Total(IEnumerable<Movement> movements, MovementKind kind) =>
        movements.Where(m => m.Kind == kind).Sum(m => m.Amount);
}

/// <summary>Entrate e uscite di un mese (1-12).</summary>
public sealed record MonthTotals(int Month, decimal Income, decimal Expense)
{
    /// <summary>I dodici mesi di un anno, anche quelli senza movimenti, a partire dai totali per mese e tipo.</summary>
    public static IReadOnlyList<MonthTotals> ForYear(IEnumerable<(int Month, MovementKind Kind, decimal Total)> totals)
    {
        var byMonthAndKind = totals.ToLookup(t => (t.Month, t.Kind), t => t.Total);
        return
        [
            .. Enumerable.Range(1, 12).Select(month => new MonthTotals(
                month,
                byMonthAndKind[(month, MovementKind.Income)].Sum(),
                byMonthAndKind[(month, MovementKind.Expense)].Sum())),
        ];
    }
}
