using OpenMoney.Core.Categorie;

namespace OpenMoney.Core.Budget;

/// <summary>Quanto la famiglia si propone di spendere al massimo ogni mese in una categoria di uscita di primo livello.</summary>
public sealed class CategoryBudget
{
    public Guid CategoryId { get; private set; }
    public decimal Amount { get; private set; }

    public CategoryBudget(Guid categoryId, decimal amount)
    {
        CategoryId = categoryId;
        Amount = amount;
    }

    public void Update(decimal amount) => Amount = amount;

    /// <summary>Codici degli errori di validazione; vuoto se il budget è coerente.</summary>
    /// <param name="category">La categoria a cui si riferisce, se esiste.</param>
    public static IReadOnlyList<string> Validate(decimal amount, Category? category)
    {
        var errors = new List<string>();
        if (amount <= 0 || !Money.IsValid(amount)) errors.Add("InvalidAmount");
        // Le sottocategorie contano nel budget della loro categoria: non ne hanno uno proprio.
        if (category is not { Kind: CategoryKind.Expense, ParentId: null }) errors.Add("InvalidBudgetCategory");
        return errors;
    }
}

/// <summary>Una categoria di uscita nel mese: il suo budget, se ne ha uno, e quanto si è speso.</summary>
public sealed record BudgetLine(Guid CategoryId, string Name, decimal? Budget, decimal Spent)
{
    /// <summary>Quanto resta; negativo se si è sforato. Null senza budget.</summary>
    public decimal? Remaining => Budget - Spent;
}

/// <summary>Il mese rispetto ai budget. I totali riguardano solo le categorie che hanno un budget.</summary>
public sealed record BudgetStatus(decimal Budget, decimal Spent, IReadOnlyList<BudgetLine> Lines)
{
    public decimal Remaining => Budget - Spent;

    /// <param name="budgets">Budget mensile per categoria.</param>
    /// <param name="spentByTopLevel">Uscite del mese per categoria di primo livello.</param>
    public static BudgetStatus From(
        IEnumerable<Category> categories, IReadOnlyDictionary<Guid, decimal> budgets, IReadOnlyDictionary<Guid, decimal> spentByTopLevel)
    {
        var lines = categories
            .Where(c => c is { Kind: CategoryKind.Expense, ParentId: null })
            .OrderBy(c => c.Name)
            .Select(c => new BudgetLine(
                c.Id, c.Name, budgets.TryGetValue(c.Id, out var budget) ? budget : null, spentByTopLevel.GetValueOrDefault(c.Id)))
            .ToList();
        var budgeted = lines.Where(l => l.Budget is not null).ToList();

        return new(budgeted.Sum(l => l.Budget!.Value), budgeted.Sum(l => l.Spent), lines);
    }
}
