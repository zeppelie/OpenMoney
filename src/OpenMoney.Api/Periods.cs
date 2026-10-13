namespace OpenMoney.Api;

/// <summary>Validazione dei periodi chiesti dal frontend.</summary>
internal static class Periods
{
    private const int FirstYear = 1990;
    private const int LastYear = 2100;

    /// <summary>La data di oggi nel fuso orario dell'installazione (variabile TZ del container).</summary>
    public static DateOnly Today(this TimeProvider time) => DateOnly.FromDateTime(time.GetLocalNow().DateTime);

    /// <summary>Dal primo giorno dell'anno al primo del successivo (escluso); null se l'anno non è plausibile.</summary>
    public static (DateOnly From, DateOnly To)? Year(int year) =>
        year is >= FirstYear and <= LastYear ? (new DateOnly(year, 1, 1), new DateOnly(year + 1, 1, 1)) : null;

    /// <summary>Dal primo giorno del mese al primo del successivo (escluso); null se anno o mese non sono validi.</summary>
    public static (DateOnly From, DateOnly To)? Month(int year, int month) =>
        Year(year) is not null && month is >= 1 and <= 12
            ? (new DateOnly(year, month, 1), new DateOnly(year, month, 1).AddMonths(1))
            : null;
}
