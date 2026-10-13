using OpenMoney.Core.Categorie;

namespace OpenMoney.Tests.Categorie;

public sealed class CategoryValuesTests
{
    private static readonly Category Casa = new(new("Casa", CategoryKind.Expense, null));
    private static readonly Category Affitto = new(new("Affitto", CategoryKind.Expense, Casa.Id));

    private static CategoryValues Child(Category parent, CategoryKind kind = CategoryKind.Expense) => new("Mutuo", kind, parent.Id);

    [Fact]
    public void Sottocategoria_dello_stesso_tipo_del_padre_e_valida()
    {
        Assert.Empty(Child(Casa).Validate(Casa));
    }

    [Fact]
    public void Il_padre_deve_esistere_ed_essere_di_primo_livello()
    {
        Assert.Equal(["InvalidParentCategory"], Child(Casa).Validate(parent: null));
        Assert.Equal(["InvalidParentCategory"], Child(Affitto).Validate(Affitto));
    }

    [Fact]
    public void Il_padre_deve_essere_dello_stesso_tipo()
    {
        Assert.Equal(["CategoryKindMismatch"], Child(Casa, CategoryKind.Income).Validate(Casa));
    }

    [Fact]
    public void Una_categoria_non_puo_essere_figlia_di_se_stessa_ne_diventare_figlia_se_ha_figli()
    {
        var trasporti = new Category(new("Trasporti", CategoryKind.Expense, null));

        Assert.Equal(["InvalidParentCategory"], Child(Casa).Validate(Casa, self: Casa));
        Assert.Equal(["InvalidParentCategory"], Child(trasporti).Validate(trasporti, self: Casa, hasChildren: true));
    }

    [Fact]
    public void Il_tipo_di_una_categoria_esistente_non_si_cambia()
    {
        Assert.Equal(["CategoryKindLocked"], new CategoryValues("Casa", CategoryKind.Income, null).Validate(null, self: Casa));
    }

    [Fact]
    public void Le_categorie_iniziali_sono_valide_e_coprono_entrate_e_uscite()
    {
        var defaults = DefaultCategories.Create();

        Assert.All(defaults, c => Assert.Empty(new CategoryValues(c.Name, c.Kind, c.ParentId).Validate(null)));
        Assert.Contains(defaults, c => c.Kind == CategoryKind.Income);
        Assert.Contains(defaults, c => c.Kind == CategoryKind.Expense);
    }
}
