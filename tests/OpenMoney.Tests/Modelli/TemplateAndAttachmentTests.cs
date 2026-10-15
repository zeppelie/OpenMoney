using OpenMoney.Core.Categorie;
using OpenMoney.Core.Modelli;
using OpenMoney.Core.Movimenti;

namespace OpenMoney.Tests.Modelli;

public sealed class TemplateAndAttachmentTests
{
    private static readonly Guid Account = Guid.NewGuid();

    private static TemplateValues Template(string? name = "Spesa", MovementKind kind = MovementKind.Expense, decimal? amount = null) =>
        new(name, kind, amount, Account, null, Guid.NewGuid(), null);

    [Fact]
    public void Un_modello_puo_non_avere_l_importo_ma_segue_le_regole_di_un_movimento()
    {
        Assert.Empty(Template().Validate(CategoryKind.Expense));
        Assert.Empty(Template(amount: 35.5m).Validate(CategoryKind.Expense));
        Assert.Equal(["InvalidAmount"], Template(amount: -1m).Validate(CategoryKind.Expense));
        Assert.Equal(["CategoryKindMismatch"], Template().Validate(CategoryKind.Income));
        Assert.Equal(["InvalidName"], Template(name: "  ").Normalized().Validate(CategoryKind.Expense));
    }

    [Fact]
    public void Normalizzando_un_modello_di_trasferimento_perde_la_categoria()
    {
        var transfer = Template(kind: MovementKind.Transfer) with { ToAccountId = Guid.NewGuid(), Note = "  " };

        var normalized = transfer.Normalized();

        Assert.Equal((null, null), (normalized.CategoryId, normalized.Note));
        Assert.Empty(normalized.Validate(null));
    }

    [Theory]
    [InlineData("image/jpeg", 2_000_000)]
    [InlineData("image/heic", 1)]
    [InlineData("application/pdf", Attachment.MaxSize)]
    public void Si_allegano_immagini_e_pdf_fino_a_10_mb(string contentType, long size)
    {
        Assert.Empty(Attachment.Validate(contentType, size));
    }

    [Fact]
    public void File_eseguibili_dal_browser_vuoti_o_troppo_grandi_vengono_rifiutati()
    {
        Assert.Equal(["UnsupportedFileType"], Attachment.Validate("text/html", 100));
        Assert.Equal(["UnsupportedFileType"], Attachment.Validate("image/svg+xml", 100));
        Assert.Equal(["UnsupportedFileType"], Attachment.Validate(null, 100));
        Assert.Equal(["EmptyFile"], Attachment.Validate("image/png", 0));
        Assert.Equal(["FileTooLarge"], Attachment.Validate("image/png", Attachment.MaxSize + 1));
    }

    [Theory]
    [InlineData(@"C:\Users\mario\scontrino.jpg", "scontrino.jpg")]
    [InlineData("../../etc/passwd", "passwd")]
    [InlineData("", "allegato")]
    [InlineData(null, "allegato")]
    public void Del_nome_del_file_resta_solo_il_nome(string? fileName, string expected)
    {
        Assert.Equal(expected, new Attachment(Guid.NewGuid(), fileName, "image/jpeg", 1, DateTimeOffset.UtcNow).FileName);
    }
}
