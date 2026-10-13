namespace OpenMoney.Core.Conti;

/// <summary>
/// Carta di credito "a saldo": le spese di un mese solare (l'estratto) vengono addebitate sul conto collegato
/// in un giorno fisso del mese successivo.
/// </summary>
public static class CardSettlement
{
    public const int MinDay = 1;

    /// <summary>Oltre il 28 il giorno non esisterebbe in tutti i mesi.</summary>
    public const int MaxDay = 28;

    public static DateOnly EndOfMonth(DateOnly date) => new DateOnly(date.Year, date.Month, 1).AddMonths(1).AddDays(-1);

    /// <summary>Giorno in cui viene addebitato l'estratto che si chiude a <paramref name="statementEnd"/>.</summary>
    public static DateOnly PaymentDate(DateOnly statementEnd, int day)
    {
        var nextMonth = statementEnd.AddDays(1);
        return new(nextMonth.Year, nextMonth.Month, day);
    }

    /// <summary>
    /// Fine dell'ultimo estratto il cui addebito è già passato. Quando si collega una carta si parte da qui:
    /// ciò che la banca ha già addebitato si considera sistemato a mano, l'app pensa ai prossimi.
    /// </summary>
    public static DateOnly LastPaidStatement(int day, DateOnly today)
    {
        var previousMonthEnd = new DateOnly(today.Year, today.Month, 1).AddDays(-1);
        return PaymentDate(previousMonthEnd, day) <= today
            ? previousMonthEnd
            : new DateOnly(previousMonthEnd.Year, previousMonthEnd.Month, 1).AddDays(-1);
    }

    /// <summary>Le chiusure degli estratti successivi a <paramref name="settledThrough"/> il cui addebito è maturato, in ordine.</summary>
    public static IReadOnlyList<DateOnly> DueStatements(DateOnly settledThrough, int day, DateOnly today)
    {
        var due = new List<DateOnly>();
        for (var end = EndOfMonth(settledThrough.AddDays(1)); PaymentDate(end, day) <= today; end = EndOfMonth(end.AddDays(1)))
            due.Add(end);
        return due;
    }

    /// <summary>Quanto va addebitato: il debito della carta alla chiusura dell'estratto; nulla se era in pari o a credito.</summary>
    public static decimal AmountDue(decimal balanceAtStatementEnd) => Math.Max(0, -balanceAtStatementEnd);
}
