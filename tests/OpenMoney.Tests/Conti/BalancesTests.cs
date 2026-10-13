using OpenMoney.Core.Conti;
using OpenMoney.Core.Movimenti;

namespace OpenMoney.Tests.Conti;

public sealed class BalancesTests
{
    [Fact]
    public void Il_saldo_somma_entrate_e_trasferimenti_in_arrivo_e_toglie_uscite_e_trasferimenti_in_partenza()
    {
        var balance = Balances.Of(
            initialBalance: 1000m,
            fromAccount: [(MovementKind.Income, 2000m), (MovementKind.Expense, 350.25m), (MovementKind.Transfer, 400m)],
            transfersIn: 50m);

        Assert.Equal(2299.75m, balance);
    }

    [Fact]
    public void Senza_movimenti_il_saldo_e_quello_iniziale()
    {
        Assert.Equal(-120m, Balances.Of(-120m, [], 0m));
    }

    [Fact]
    public void Il_patrimonio_separa_cio_che_si_possiede_da_cio_che_si_deve()
    {
        Assert.Equal(new NetWorth(1500m, 300m, 1200m), NetWorth.From([1000m, 500m, -300m, 0m]));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public void Un_conto_senza_nome_viene_rifiutato(string? name)
    {
        Assert.Equal(["InvalidName"], new AccountValues(name, AccountGroup.Bank, 0m).Normalized().Validate());
    }

    [Fact]
    public void Gruppo_inesistente_e_saldo_con_millesimi_vengono_rifiutati()
    {
        var values = new AccountValues(" Conto ", (AccountGroup)99, 10.001m).Normalized();

        Assert.Equal("Conto", values.Name);
        Assert.Equal(["InvalidAccountGroup", "InvalidAmount"], values.Validate());
    }
}
