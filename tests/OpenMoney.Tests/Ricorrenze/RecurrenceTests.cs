using OpenMoney.Core.Categorie;
using OpenMoney.Core.Movimenti;
using OpenMoney.Core.Ricorrenze;

namespace OpenMoney.Tests.Ricorrenze;

public sealed class RecurrenceTests
{
    private static RecurrenceValues Values(
        DateOnly start, Frequency frequency = Frequency.Monthly, int? occurrences = null, DateOnly? endDate = null, decimal amount = 50m) =>
        new(new MovementValues(start, MovementKind.Expense, amount, Guid.NewGuid(), null, Guid.NewGuid(), "Palestra"),
            frequency, occurrences, endDate);

    private static Recurrence Recurrence(RecurrenceValues values) => new(values, "utente");

    [Fact]
    public void Genera_i_movimenti_maturati_fino_a_oggi_e_non_li_ripete()
    {
        var recurrence = Recurrence(Values(new DateOnly(2026, 8, 15)));

        var due = recurrence.TakeDue(new DateOnly(2026, 10, 14));

        Assert.Equal([new DateOnly(2026, 8, 15), new DateOnly(2026, 9, 15)], due.Select(m => m.Date));
        Assert.All(due, m => Assert.Equal((50m, "Palestra"), (m.Amount, m.Note)));
        Assert.Empty(recurrence.TakeDue(new DateOnly(2026, 10, 14)));
        Assert.Equal(new DateOnly(2026, 10, 15), recurrence.NextDate);
    }

    [Fact]
    public void Una_ricorrenza_del_31_cade_a_fine_mese_nei_mesi_corti_e_poi_torna_al_31()
    {
        var recurrence = Recurrence(Values(new DateOnly(2026, 1, 31)));

        var dates = recurrence.TakeDue(new DateOnly(2026, 3, 31)).Select(m => m.Date);

        Assert.Equal([new DateOnly(2026, 1, 31), new DateOnly(2026, 2, 28), new DateOnly(2026, 3, 31)], dates);
    }

    [Fact]
    public void Le_rate_finiscono_dopo_il_numero_di_volte_indicato()
    {
        var installments = Recurrence(Values(new DateOnly(2026, 1, 10), occurrences: 3));

        Assert.Equal(3, installments.TakeDue(new DateOnly(2030, 1, 1)).Count);
        Assert.Null(installments.NextDate);
    }

    [Fact]
    public void La_data_di_fine_e_compresa()
    {
        var recurrence = Recurrence(Values(new DateOnly(2026, 1, 5), Frequency.Weekly, endDate: new DateOnly(2026, 1, 19)));

        var dates = recurrence.TakeDue(new DateOnly(2026, 12, 31)).Select(m => m.Date);

        Assert.Equal([new DateOnly(2026, 1, 5), new DateOnly(2026, 1, 12), new DateOnly(2026, 1, 19)], dates);
        Assert.Null(recurrence.NextDate);
    }

    [Fact]
    public void Una_ricorrenza_annuale_del_29_febbraio_cade_il_28_negli_anni_normali()
    {
        var recurrence = Recurrence(Values(new DateOnly(2024, 2, 29), Frequency.Yearly));

        var dates = recurrence.TakeDue(new DateOnly(2025, 12, 31)).Select(m => m.Date);

        Assert.Equal([new DateOnly(2024, 2, 29), new DateOnly(2025, 2, 28)], dates);
    }

    [Fact]
    public void Modificando_cambia_l_importo_dei_prossimi_movimenti_ma_non_il_calendario()
    {
        var original = Values(new DateOnly(2026, 9, 1));
        var recurrence = Recurrence(original);
        recurrence.TakeDue(new DateOnly(2026, 9, 30));

        var raised = original with { Movement = original.Movement with { Amount = 60m } };
        Assert.Empty(recurrence.ValidateUpdate(raised));
        recurrence.Update(raised);

        var next = Assert.Single(recurrence.TakeDue(new DateOnly(2026, 10, 1)));
        Assert.Equal((new DateOnly(2026, 10, 1), 60m), (next.Date, next.Amount));
        Assert.Equal(["RecurrenceScheduleLocked"], recurrence.ValidateUpdate(original with { Frequency = Frequency.Weekly }));
        Assert.Equal(
            ["RecurrenceScheduleLocked"],
            recurrence.ValidateUpdate(original with { Movement = original.Movement with { Date = new DateOnly(2026, 9, 2) } }));
    }

    [Fact]
    public void Numero_di_volte_e_data_di_fine_devono_avere_senso()
    {
        var start = new DateOnly(2026, 10, 1);

        Assert.Empty(Values(start, occurrences: 12).Validate(CategoryKind.Expense));
        Assert.Equal(["InvalidOccurrences"], Values(start, occurrences: 0).Validate(CategoryKind.Expense));
        Assert.Equal(["InvalidEndDate"], Values(start, endDate: start.AddDays(-1)).Validate(CategoryKind.Expense));
        Assert.Equal(["InvalidAmount", "InvalidFrequency"], Values(start, (Frequency)9, amount: 0m).Validate(CategoryKind.Expense));
    }
}
