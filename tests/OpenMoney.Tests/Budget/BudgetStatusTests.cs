using OpenMoney.Core.Budget;
using OpenMoney.Core.Categorie;

namespace OpenMoney.Tests.Budget;

public sealed class BudgetStatusTests
{
    private static readonly Category Casa = new(new("Casa", CategoryKind.Expense, null));
    private static readonly Category Affitto = new(new("Affitto", CategoryKind.Expense, Casa.Id));
    private static readonly Category Alimentari = new(new("Alimentari", CategoryKind.Expense, null));
    private static readonly Category Stipendio = new(new("Stipendio", CategoryKind.Income, null));
    private static readonly Category[] Categories = [Casa, Affitto, Alimentari, Stipendio];

    [Fact]
    public void Ogni_categoria_di_uscita_di_primo_livello_ha_una_riga_in_ordine_alfabetico()
    {
        var status = BudgetStatus.From(
            Categories,
            budgets: new Dictionary<Guid, decimal> { [Alimentari.Id] = 400m },
            spentByTopLevel: new Dictionary<Guid, decimal> { [Alimentari.Id] = 450m, [Casa.Id] = 700m });

        Assert.Equal(
            [new BudgetLine(Alimentari.Id, "Alimentari", 400m, 450m), new BudgetLine(Casa.Id, "Casa", null, 700m)],
            status.Lines);
        Assert.Equal(-50m, status.Lines[0].Remaining);
        Assert.Null(status.Lines[1].Remaining);
    }

    [Fact]
    public void I_totali_contano_solo_le_categorie_con_un_budget()
    {
        var status = BudgetStatus.From(
            Categories,
            budgets: new Dictionary<Guid, decimal> { [Alimentari.Id] = 400m, [Casa.Id] = 800m },
            spentByTopLevel: new Dictionary<Guid, decimal> { [Alimentari.Id] = 150m });

        Assert.Equal((1200m, 150m, 1050m), (status.Budget, status.Spent, status.Remaining));
    }

    [Fact]
    public void Il_budget_vale_solo_per_categorie_di_uscita_di_primo_livello_e_importi_positivi()
    {
        Assert.Empty(CategoryBudget.Validate(400m, Casa));
        Assert.Equal(["InvalidBudgetCategory"], CategoryBudget.Validate(400m, Affitto));
        Assert.Equal(["InvalidBudgetCategory"], CategoryBudget.Validate(400m, Stipendio));
        Assert.Equal(["InvalidAmount", "InvalidBudgetCategory"], CategoryBudget.Validate(0m, null));
    }
}
