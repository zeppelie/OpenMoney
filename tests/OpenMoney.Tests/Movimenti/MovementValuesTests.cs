using OpenMoney.Core.Categorie;
using OpenMoney.Core.Movimenti;

namespace OpenMoney.Tests.Movimenti;

public sealed class MovementValuesTests
{
    private static readonly Guid Account = Guid.NewGuid();
    private static readonly Guid OtherAccount = Guid.NewGuid();
    private static readonly Guid Category = Guid.NewGuid();

    private static MovementValues Expense(decimal amount = 12.50m) =>
        new(new DateOnly(2026, 10, 13), MovementKind.Expense, amount, Account, null, Category, null);

    private static MovementValues Transfer(Guid? to) =>
        new(new DateOnly(2026, 10, 13), MovementKind.Transfer, 100m, Account, to, null, null);

    [Fact]
    public void Uscita_con_categoria_di_uscita_e_valida()
    {
        Assert.Empty(Expense().Validate(CategoryKind.Expense));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(1.234)]
    [InlineData(1_000_000_000)]
    public void Importo_deve_essere_positivo_al_centesimo_e_sotto_il_tetto(decimal amount)
    {
        Assert.Equal(["InvalidAmount"], Expense(amount).Validate(CategoryKind.Expense));
    }

    [Fact]
    public void Uscita_senza_categoria_o_con_categoria_di_entrata_viene_rifiutata()
    {
        Assert.Equal(["MissingCategory"], Expense().Validate(null));
        Assert.Equal(["CategoryKindMismatch"], Expense().Validate(CategoryKind.Income));
    }

    [Fact]
    public void Trasferimento_richiede_un_conto_di_destinazione_diverso()
    {
        Assert.Empty(Transfer(OtherAccount).Validate(null));
        Assert.Equal(["MissingToAccount"], Transfer(null).Validate(null));
        Assert.Equal(["SameAccount"], Transfer(Account).Validate(null));
    }

    [Fact]
    public void Normalizzando_resta_solo_cio_che_riguarda_il_tipo_scelto()
    {
        var transfer = (Transfer(OtherAccount) with { CategoryId = Category, Note = "  giroconto " }).Normalized();
        var expense = (Expense() with { ToAccountId = OtherAccount, Note = "   " }).Normalized();

        Assert.Equal((null, "giroconto"), (transfer.CategoryId, transfer.Note));
        Assert.Equal((null, null), (expense.ToAccountId, expense.Note));
    }

    [Fact]
    public void Data_fuori_intervallo_e_nota_troppo_lunga_vengono_rifiutate()
    {
        var values = Expense() with { Date = new DateOnly(1800, 1, 1), Note = new string('x', MovementValues.NoteMaxLength + 1) };

        Assert.Equal(["InvalidDate", "NoteTooLong"], values.Validate(CategoryKind.Expense));
    }
}
