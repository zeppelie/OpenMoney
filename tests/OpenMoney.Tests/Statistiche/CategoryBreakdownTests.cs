using OpenMoney.Core.Categorie;
using OpenMoney.Core.Statistiche;

namespace OpenMoney.Tests.Statistiche;

public sealed class CategoryBreakdownTests
{
    private static readonly Category Casa = new(new("Casa", CategoryKind.Expense, null));
    private static readonly Category Affitto = new(new("Affitto", CategoryKind.Expense, Casa.Id));
    private static readonly Category Alimentari = new(new("Alimentari", CategoryKind.Expense, null));
    private static readonly Category Viaggi = new(new("Viaggi", CategoryKind.Expense, null));
    private static readonly Category[] Categories = [Casa, Affitto, Alimentari, Viaggi];

    [Fact]
    public void Le_sottocategorie_confluiscono_nella_loro_categoria()
    {
        var totals = CategoryBreakdown.ByTopLevel([(Casa.Id, 50m), (Affitto.Id, 700m), (Alimentari.Id, 250m)], Categories);

        Assert.Equal(750m, totals[Casa.Id]);
        Assert.Equal(250m, totals[Alimentari.Id]);
        Assert.False(totals.ContainsKey(Affitto.Id));
    }

    [Fact]
    public void Le_quote_vanno_dalla_piu_pesante_e_le_categorie_senza_movimenti_non_compaiono()
    {
        var shares = CategoryBreakdown.Shares([(Alimentari.Id, 250m), (Affitto.Id, 700m), (Casa.Id, 50m)], Categories);

        Assert.Equal(
            [new CategoryShare(Casa.Id, "Casa", 750m, 75m), new CategoryShare(Alimentari.Id, "Alimentari", 250m, 25m)],
            shares);
    }

    [Fact]
    public void Le_percentuali_hanno_un_decimale()
    {
        var shares = CategoryBreakdown.Shares([(Casa.Id, 1m), (Alimentari.Id, 2m)], Categories);

        Assert.Equal([66.7m, 33.3m], shares.Select(s => s.Percent));
    }

    [Fact]
    public void Senza_movimenti_non_ci_sono_quote_e_una_categoria_sconosciuta_viene_ignorata()
    {
        Assert.Empty(CategoryBreakdown.Shares([], Categories));
        Assert.Empty(CategoryBreakdown.Shares([(Guid.NewGuid(), 10m)], Categories));
    }
}
