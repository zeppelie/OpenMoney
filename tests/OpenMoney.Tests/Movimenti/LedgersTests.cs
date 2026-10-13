using OpenMoney.Core.Movimenti;

namespace OpenMoney.Tests.Movimenti;

public sealed class LedgersTests
{
    private static readonly DateTimeOffset Morning = new(2026, 10, 13, 8, 0, 0, TimeSpan.Zero);

    private static Movement Movement(int day, MovementKind kind, decimal amount, int hoursLater = 0) =>
        new(
            new MovementValues(new DateOnly(2026, 10, day), kind, amount, Guid.NewGuid(), null, null, null),
            "utente",
            Morning.AddHours(hoursLater));

    [Fact]
    public void I_giorni_vanno_dal_piu_recente_e_dentro_il_giorno_dall_ultimo_inserito()
    {
        var first = Movement(13, MovementKind.Expense, 10m);
        var second = Movement(13, MovementKind.Expense, 20m, hoursLater: 2);

        var ledger = MonthLedger.From([first, Movement(2, MovementKind.Income, 1500m), second]);

        Assert.Equal([new DateOnly(2026, 10, 13), new DateOnly(2026, 10, 2)], ledger.Days.Select(d => d.Date));
        Assert.Equal([second, first], ledger.Days[0].Movements);
    }

    [Fact]
    public void I_trasferimenti_si_vedono_ma_non_contano_nei_totali()
    {
        var ledger = MonthLedger.From(
        [
            Movement(13, MovementKind.Expense, 10.10m),
            Movement(13, MovementKind.Expense, 20.20m),
            Movement(13, MovementKind.Transfer, 500m),
            Movement(2, MovementKind.Income, 1500m),
        ]);

        Assert.Equal((1500m, 30.30m), (ledger.Income, ledger.Expense));
        Assert.Equal((0m, 30.30m, 3), (ledger.Days[0].Income, ledger.Days[0].Expense, ledger.Days[0].Movements.Count));
    }

    [Fact]
    public void Senza_movimenti_il_registro_e_vuoto()
    {
        var ledger = MonthLedger.From([]);

        Assert.Equal((0m, 0m), (ledger.Income, ledger.Expense));
        Assert.Empty(ledger.Days);
    }

    [Fact]
    public void L_anno_ha_sempre_dodici_mesi_e_ignora_i_trasferimenti()
    {
        var months = MonthTotals.ForYear(
        [
            (3, MovementKind.Income, 2000m),
            (3, MovementKind.Expense, 750.50m),
            (3, MovementKind.Transfer, 9999m),
            (12, MovementKind.Expense, 100m),
        ]);

        Assert.Equal(12, months.Count);
        Assert.Equal(new MonthTotals(3, 2000m, 750.50m), months[2]);
        Assert.Equal(new MonthTotals(12, 0m, 100m), months[11]);
        Assert.Equal(new MonthTotals(1, 0m, 0m), months[0]);
    }
}
