using OpenMoney.Core.Movimenti;

namespace OpenMoney.Tests.Movimenti;

public sealed class MovementCsvTests
{
    private static ExportRow Row(string? note = null, decimal amount = 1234.5m) =>
        new(new DateOnly(2026, 10, 3), MovementKind.Expense, amount, "Conto BPM", null, "Casa", "Affitto", note, "Mario");

    private static string[] Lines(params ExportRow[] rows) => MovementCsv.Write(rows).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

    [Fact]
    public void La_prima_riga_e_l_intestazione_e_ogni_movimento_ha_una_riga_all_italiana()
    {
        var lines = Lines(Row("spesa"));

        Assert.Equal("Data;Tipo;Importo;Conto;Conto di destinazione;Categoria;Sottocategoria;Nota;Inserito da", lines[0]);
        Assert.Equal("03/10/2026;Uscita;1234,50;Conto BPM;;Casa;Affitto;spesa;Mario", lines[1]);
    }

    [Fact]
    public void Un_trasferimento_indica_i_due_conti_e_nessuna_categoria()
    {
        var transfer = new ExportRow(new DateOnly(2026, 10, 15), MovementKind.Transfer, 50m, "Conto BPM", "Visa", null, null, null, null);

        Assert.Equal("15/10/2026;Trasferimento;50,00;Conto BPM;Visa;;;;", Lines(transfer)[1]);
    }

    [Fact]
    public void Un_testo_con_separatore_virgolette_o_a_capo_viene_racchiuso_tra_virgolette()
    {
        Assert.EndsWith(";\"pane; latte\";Mario", Lines(Row("pane; latte"))[1]);
        Assert.EndsWith(";\"detto \"\"ok\"\"\";Mario", Lines(Row("detto \"ok\""))[1]);
        Assert.Contains("\"riga 1\nriga 2\"", MovementCsv.Write([Row("riga 1\nriga 2")]));
    }

    [Theory]
    [InlineData("=1+1")]
    [InlineData("+39 333")]
    [InlineData("-10%")]
    [InlineData("@utente")]
    public void Un_testo_che_sembra_una_formula_viene_reso_innocuo(string note)
    {
        Assert.EndsWith($";'{note};Mario", Lines(Row(note))[1]);
    }

    [Fact]
    public void Senza_movimenti_resta_la_sola_intestazione()
    {
        Assert.Single(Lines());
    }
}
