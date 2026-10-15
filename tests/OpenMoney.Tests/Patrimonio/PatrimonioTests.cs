using OpenMoney.Core.Patrimonio;

namespace OpenMoney.Tests.Patrimonio;

public sealed class PatrimonioTests
{
    private static readonly Portfolio Intesa = new("Intesa");
    private static readonly Portfolio Azimut = new("Azimut");
    private static readonly Holding Bonds = Investment("Alpha Bonds", Intesa);
    private static readonly Holding Etf = Investment("Eq. World ETF", Intesa);
    private static readonly Holding Eltif = Investment("ELTIF Escalator", Azimut);
    private static readonly Holding Pension = new(new("Fondo integrativo", HoldingKind.Pension, null, false));
    private static readonly Holding Mortgage = new(new("Mutuo", HoldingKind.Debt, null, false));

    private static readonly Dictionary<Guid, Holding> Holdings =
        new[] { Bonds, Etf, Eltif, Pension, Mortgage }.ToDictionary(h => h.Id);

    private static readonly Dictionary<Guid, Portfolio> Portfolios = new[] { Intesa, Azimut }.ToDictionary(p => p.Id);

    private static Holding Investment(string name, Portfolio portfolio) =>
        new(new(name, HoldingKind.Investment, portfolio.Id, false));

    private static Snapshot Snapshot(DateOnly date, params SnapshotAccount[] accounts) => new(new(
        date,
        [
            new(Bonds.Id, 10_000m, 10_094.66m),
            new(Etf.Id, 15_000m, 15_760.24m),
            new(Eltif.Id, 10_000m, 10_226.70m),
            new(Pension.Id, null, 21_130.67m),
            new(Mortgage.Id, null, 80_000m),
        ],
        accounts,
        null));

    [Fact]
    public void Il_totale_e_gestito_piu_conti_e_il_netto_aggiunge_la_previdenza_e_toglie_il_mutuo()
    {
        var summary = SnapshotSummary.From(
            Snapshot(new DateOnly(2025, 7, 15), new SnapshotAccount(null, "Satispay", 2_308.59m), new SnapshotAccount(Guid.NewGuid(), "Bpm", 11_382.75m)),
            Holdings, Portfolios);

        Assert.Equal(36_081.60m, summary.Managed);
        Assert.Equal(13_691.34m, summary.Liquidity);
        Assert.Equal(49_772.94m, summary.Total);
        Assert.Equal((21_130.67m, 80_000m), (summary.PensionTotal, summary.DebtTotal));
        Assert.Equal(49_772.94m + 21_130.67m - 80_000m, summary.NetWorth);
    }

    [Fact]
    public void Gli_investimenti_sono_divisi_per_gestore_con_il_loro_guadagno()
    {
        var summary = SnapshotSummary.From(Snapshot(new DateOnly(2025, 7, 15)), Holdings, Portfolios);

        Assert.Equal(["Azimut", "Intesa"], summary.Portfolios.Select(p => p.Name));
        var intesa = summary.Portfolios[1];
        Assert.Equal((25_000m, 25_854.90m, 854.90m, 3.42m), (intesa.Invested, intesa.Value, intesa.Gain, intesa.GainPercent));
        Assert.Equal(0.95m, intesa.Holdings.Single(h => h.Name == "Alpha Bonds").GainPercent);
        Assert.Equal(["Fondo integrativo"], summary.Pension.Select(h => h.Name));
        Assert.Equal(["Mutuo"], summary.Debts.Select(h => h.Name));
    }

    [Fact]
    public void Senza_la_cifra_investita_il_guadagno_non_si_calcola()
    {
        var old = new Snapshot(new(new DateOnly(2017, 8, 21), [new(Bonds.Id, null, 10_070.05m), new(Etf.Id, 15_000m, 15_100m)], [], null));

        var intesa = SnapshotSummary.From(old, Holdings, Portfolios).Portfolios.Single();

        Assert.Equal((null, null), (intesa.Invested, intesa.GainPercent));
        Assert.Equal(25_170.05m, intesa.Value);
    }

    [Fact]
    public void La_nuova_rilevazione_riparte_dai_valori_precedenti_e_dai_saldi_calcolati()
    {
        var bpm = Guid.NewGuid();
        var previous = Snapshot(new DateOnly(2025, 9, 15), new SnapshotAccount(null, "Satispay", 2_100m), new SnapshotAccount(bpm, "Bpm", 9_000m));
        var newEtf = Investment("FTSE All World", Intesa);

        var draft = SnapshotValues.Draft(new DateOnly(2025, 10, 15), previous, [Bonds, newEtf], [(bpm, "Bpm", 9_500m)]);

        Assert.Equal(new DateOnly(2025, 10, 15), draft.Date);
        Assert.Equal([new SnapshotHolding(Bonds.Id, 10_000m, 10_094.66m), new SnapshotHolding(newEtf.Id, null, 0m)], draft.Holdings);
        // Il saldo del conto di OpenMoney è quello calcolato oggi; quello tenuto solo qui riparte dalla volta prima.
        Assert.Equal([new SnapshotAccount(bpm, "Bpm", 9_500m), new SnapshotAccount(null, "Satispay", 2_100m)], draft.Accounts);
    }

    [Fact]
    public void La_prima_rilevazione_parte_da_zero()
    {
        var draft = SnapshotValues.Draft(new DateOnly(2025, 3, 30), previous: null, [Bonds], []);

        Assert.Equal([new SnapshotHolding(Bonds.Id, null, 0m)], draft.Holdings);
        Assert.Empty(draft.Accounts);
    }

    [Fact]
    public void Valori_negativi_posizioni_ripetute_e_conti_senza_nome_vengono_rifiutati()
    {
        var values = new SnapshotValues(
            new DateOnly(2025, 3, 30),
            [new(Bonds.Id, -1m, 10m), new(Bonds.Id, null, 5m)],
            [new(null, " ", 10m)],
            null).Normalized();

        Assert.Equal(["InvalidAmount", "DuplicateHolding", "InvalidName"], values.Validate());
    }

    [Fact]
    public void Un_conto_puo_essere_in_rosso_nella_rilevazione()
    {
        var values = new SnapshotValues(new DateOnly(2025, 3, 30), [], [new(null, "Visa", -235.40m)], null);

        Assert.Empty(values.Validate());
    }

    [Fact]
    public void Solo_gli_investimenti_hanno_un_gestore()
    {
        Assert.Equal(["MissingPortfolio"], new HoldingValues("ETF", HoldingKind.Investment, null, false).Normalized().Validate(false));
        var pension = new HoldingValues("Fondo", HoldingKind.Pension, Intesa.Id, false).Normalized();
        Assert.Null(pension.PortfolioId);
        Assert.Empty(pension.Validate(false));
    }
}
