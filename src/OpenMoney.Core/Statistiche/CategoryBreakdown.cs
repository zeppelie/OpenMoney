using OpenMoney.Core.Categorie;

namespace OpenMoney.Core.Statistiche;

/// <summary>Quanto pesa una categoria di primo livello sul totale del periodo.</summary>
public sealed record CategoryShare(Guid CategoryId, string Name, decimal Total, decimal Percent);

/// <summary>Ripartizione di entrate o uscite per categoria: le sottocategorie confluiscono nella loro categoria.</summary>
public static class CategoryBreakdown
{
    /// <summary>Somma i totali per categoria di primo livello; una categoria sconosciuta viene ignorata.</summary>
    public static IReadOnlyDictionary<Guid, decimal> ByTopLevel(
        IEnumerable<(Guid CategoryId, decimal Total)> totals, IEnumerable<Category> categories)
    {
        var topLevelOf = categories.ToDictionary(c => c.Id, c => c.ParentId ?? c.Id);
        return totals
            .Where(t => topLevelOf.ContainsKey(t.CategoryId))
            .GroupBy(t => topLevelOf[t.CategoryId], t => t.Total)
            .ToDictionary(g => g.Key, g => g.Sum());
    }

    /// <summary>Le categorie con un totale, dalla più pesante, con la loro quota percentuale (un decimale).</summary>
    public static IReadOnlyList<CategoryShare> Shares(
        IEnumerable<(Guid CategoryId, decimal Total)> totals, IReadOnlyCollection<Category> categories)
    {
        var byTopLevel = ByTopLevel(totals, categories);
        var sum = byTopLevel.Values.Sum();
        var names = categories.ToDictionary(c => c.Id, c => c.Name);

        return
        [
            .. byTopLevel
                .Where(t => t.Value != 0)
                .OrderByDescending(t => t.Value)
                .ThenBy(t => names[t.Key])
                .Select(t => new CategoryShare(t.Key, names[t.Key], t.Value, Math.Round(t.Value / sum * 100, 1, MidpointRounding.AwayFromZero))),
        ];
    }
}
