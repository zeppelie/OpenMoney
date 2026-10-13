using OpenMoney.Core.Movimenti;

namespace OpenMoney.Core.Conti;

/// <summary>Quanto si possiede (saldi positivi), quanto si deve (saldi negativi) e la differenza.</summary>
public sealed record NetWorth(decimal Assets, decimal Liabilities, decimal Total)
{
    public static NetWorth From(IEnumerable<decimal> balances)
    {
        var all = balances.ToList();
        var assets = all.Where(b => b > 0).Sum();
        var liabilities = -all.Where(b => b < 0).Sum();
        return new(assets, liabilities, assets - liabilities);
    }
}

public static class Balances
{
    /// <summary>
    /// Saldo di un conto: saldo iniziale, più le entrate, meno le uscite e i trasferimenti partiti dal conto,
    /// più i trasferimenti arrivati.
    /// </summary>
    /// <param name="fromAccount">Totali dei movimenti registrati sul conto, per tipo.</param>
    /// <param name="transfersIn">Totale dei trasferimenti che hanno il conto come destinazione.</param>
    public static decimal Of(decimal initialBalance, IEnumerable<(MovementKind Kind, decimal Total)> fromAccount, decimal transfersIn) =>
        initialBalance + transfersIn + fromAccount.Sum(t => t.Kind == MovementKind.Income ? t.Total : -t.Total);
}
