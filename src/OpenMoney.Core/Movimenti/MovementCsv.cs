using System.Globalization;

namespace OpenMoney.Core.Movimenti;

/// <summary>Un movimento come lo si legge in un foglio di calcolo: nomi al posto degli identificativi.</summary>
public sealed record ExportRow(
    DateOnly Date, MovementKind Kind, decimal Amount, string Account, string? ToAccount, string? Category,
    string? Subcategory, string? Note, string? Author);

/// <summary>Esportazione in CSV come lo apre Excel in italiano: punto e virgola tra i campi, virgola nei decimali.</summary>
public static class MovementCsv
{
    private const string Separator = ";";
    private static readonly CultureInfo Italian = CultureInfo.GetCultureInfo("it-IT");

    private static readonly string[] Header =
        ["Data", "Tipo", "Importo", "Conto", "Conto di destinazione", "Categoria", "Sottocategoria", "Nota", "Inserito da"];

    public static string Write(IEnumerable<ExportRow> rows) =>
        string.Join("\r\n", rows.Select(Line).Prepend(string.Join(Separator, Header))) + "\r\n";

    private static string Line(ExportRow row) => string.Join(
        Separator,
        row.Date.ToString("dd/MM/yyyy", Italian),
        KindLabel(row.Kind),
        // Senza separatore delle migliaia: Excel lo prenderebbe per testo.
        row.Amount.ToString("0.00", Italian),
        Text(row.Account),
        Text(row.ToAccount),
        Text(row.Category),
        Text(row.Subcategory),
        Text(row.Note),
        Text(row.Author));

    private static string KindLabel(MovementKind kind) => kind switch
    {
        MovementKind.Income => "Entrata",
        MovementKind.Expense => "Uscita",
        _ => "Trasferimento",
    };

    private static string Text(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        // Un testo che inizia così verrebbe eseguito come formula all'apertura del file: l'apostrofo lo rende testo.
        if (value[0] is '=' or '+' or '-' or '@')
            value = "'" + value;

        return value.AsSpan().IndexOfAny(";\"\r\n") >= 0 ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    }
}
