using OpenMoney.Core.Conti;

namespace OpenMoney.Tests.Conti;

public sealed class CardSettlementTests
{
    private static readonly Guid Bank = Guid.NewGuid();

    private static AccountValues Card(Guid? settlementAccount, int? day) => new("Visa", AccountGroup.Card, 0m, settlementAccount, day);

    [Fact]
    public void L_estratto_di_un_mese_si_addebita_nel_giorno_scelto_del_mese_dopo()
    {
        Assert.Equal(new DateOnly(2026, 11, 15), CardSettlement.PaymentDate(new DateOnly(2026, 10, 31), 15));
        Assert.Equal(new DateOnly(2027, 1, 15), CardSettlement.PaymentDate(new DateOnly(2026, 12, 31), 15));
    }

    [Fact]
    public void Collegando_una_carta_si_parte_dagli_estratti_ancora_da_addebitare()
    {
        // Il 14 ottobre l'addebito di settembre (15 ottobre) deve ancora arrivare: l'ultimo già passato è agosto.
        Assert.Equal(new DateOnly(2026, 8, 31), CardSettlement.LastPaidStatement(15, new DateOnly(2026, 10, 14)));
        Assert.Equal(new DateOnly(2026, 9, 30), CardSettlement.LastPaidStatement(15, new DateOnly(2026, 10, 15)));
        Assert.Equal(new DateOnly(2025, 12, 31), CardSettlement.LastPaidStatement(15, new DateOnly(2026, 1, 20)));
    }

    [Fact]
    public void Maturano_in_ordine_tutti_gli_estratti_il_cui_addebito_e_passato()
    {
        var settledThrough = new DateOnly(2026, 8, 31);

        Assert.Empty(CardSettlement.DueStatements(settledThrough, 15, new DateOnly(2026, 10, 14)));
        Assert.Equal([new DateOnly(2026, 9, 30)], CardSettlement.DueStatements(settledThrough, 15, new DateOnly(2026, 10, 15)));
        Assert.Equal(
            [new DateOnly(2026, 9, 30), new DateOnly(2026, 10, 31), new DateOnly(2026, 11, 30)],
            CardSettlement.DueStatements(settledThrough, 15, new DateOnly(2026, 12, 20)));
    }

    [Fact]
    public void Si_addebita_il_debito_alla_chiusura_e_nulla_se_la_carta_era_in_pari_o_a_credito()
    {
        Assert.Equal(235.40m, CardSettlement.AmountDue(-235.40m));
        Assert.Equal(0m, CardSettlement.AmountDue(0m));
        Assert.Equal(0m, CardSettlement.AmountDue(12m));
    }

    [Fact]
    public void Conto_e_giorno_di_addebito_vanno_insieme_e_il_giorno_esiste_in_ogni_mese()
    {
        Assert.Empty(Card(Bank, 15).Normalized().Validate());
        Assert.Empty(Card(null, null).Normalized().Validate());
        Assert.Equal(["InvalidSettlement"], Card(Bank, null).Normalized().Validate());
        Assert.Equal(["InvalidSettlement"], Card(null, 15).Normalized().Validate());
        Assert.Equal(["InvalidSettlement"], Card(Bank, 31).Normalized().Validate());
    }

    [Fact]
    public void L_addebito_riguarda_solo_le_carte()
    {
        var bank = new AccountValues("Conto", AccountGroup.Bank, 0m, Bank, 15).Normalized();

        Assert.Equal((null, null), (bank.SettlementAccountId, bank.SettlementDay));
    }

    [Fact]
    public void Cambiando_il_giorno_non_si_riparte_e_togliendo_l_addebito_si_azzera()
    {
        var card = new Account(Card(Bank, 15), today: new DateOnly(2026, 10, 14));
        Assert.Equal(new DateOnly(2026, 8, 31), card.SettledThrough);

        card.MarkSettled(new DateOnly(2026, 9, 30));
        card.Update(Card(Bank, 20), today: new DateOnly(2026, 10, 25));
        Assert.Equal(new DateOnly(2026, 9, 30), card.SettledThrough);

        card.Update(Card(null, null), today: new DateOnly(2026, 10, 25));
        Assert.Null(card.SettledThrough);
    }
}
