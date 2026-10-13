namespace OpenMoney.Core.Categorie;

/// <summary>Categorie proposte a un'installazione nuova; poi si cambiano liberamente.</summary>
public static class DefaultCategories
{
    private static readonly string[] Expenses =
    [
        "Alimentari", "Ristoranti e bar", "Casa", "Bollette", "Trasporti", "Auto", "Salute", "Abbigliamento",
        "Tempo libero", "Viaggi", "Istruzione", "Regali", "Tasse", "Altro",
    ];

    private static readonly string[] Incomes = ["Stipendio", "Bonus", "Rimborsi", "Interessi e investimenti", "Regali", "Altro"];

    public static IReadOnlyList<Category> Create() =>
    [
        .. Expenses.Select(name => new Category(new(name, CategoryKind.Expense, null))),
        .. Incomes.Select(name => new Category(new(name, CategoryKind.Income, null))),
    ];
}
