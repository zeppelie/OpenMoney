using System.Globalization;
using Microsoft.EntityFrameworkCore;
using OpenMoney.Api.Conti;
using OpenMoney.Core.Conti;
using OpenMoney.Core.Movimenti;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Ricorrenze;

/// <summary>Crea i movimenti che maturano da soli: quelli delle ricorrenze e gli addebiti mensili delle carte.</summary>
public sealed class ScheduledMovements(AppDbContext db, TimeProvider time)
{
    private static readonly CultureInfo Italian = CultureInfo.GetCultureInfo("it-IT");

    // ponytail: un solo giro alla volta in questo processo, perché il giro orario e una richiesta non generino
    // due volte lo stesso movimento. Con più istanze dell'app servirebbe un blocco sul database.
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task RunAsync(CancellationToken ct)
    {
        await Gate.WaitAsync(ct);
        try
        {
            var today = time.Today();
            await GenerateRecurringAsync(today, ct);
            await SettleCardsAsync(today, ct);
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task GenerateRecurringAsync(DateOnly today, CancellationToken ct)
    {
        foreach (var recurrence in await db.Recurrences.ToListAsync(ct))
            db.Movements.AddRange(recurrence.TakeDue(today).Select(values => new Movement(values, recurrence.AuthorId, time.GetUtcNow())));

        await db.SaveChangesAsync(ct);
    }

    private async Task SettleCardsAsync(DateOnly today, CancellationToken ct)
    {
        var cards = await db.Accounts.Where(a => a.SettlementDay != null).ToListAsync(ct);
        foreach (var card in cards)
        {
            // Un estratto alla volta, salvando: l'addebito di un mese cambia il saldo da cui si calcola il successivo.
            foreach (var statementEnd in CardSettlement.DueStatements(card.SettledThrough!.Value, card.SettlementDay!.Value, today))
            {
                var balance = (await AccountBalances.LoadAsync(db, statementEnd, ct))[card.Id];
                if (CardSettlement.AmountDue(balance) is > 0 and var due)
                {
                    var note = $"Addebito {card.Name} – {statementEnd.ToString("MMMM yyyy", Italian)}";
                    db.Movements.Add(new Movement(
                        new(CardSettlement.PaymentDate(statementEnd, card.SettlementDay.Value), MovementKind.Transfer, due,
                            card.SettlementAccountId!.Value, card.Id, null, note),
                        authorId: null,
                        time.GetUtcNow()));
                }

                card.MarkSettled(statementEnd);
                await db.SaveChangesAsync(ct);
            }
        }
    }
}

/// <summary>Fa girare <see cref="ScheduledMovements"/> all'avvio e poi ogni ora: basta per non perdere un giorno.</summary>
public sealed class ScheduledMovementsWorker(IServiceScopeFactory scopes, ILogger<ScheduledMovementsWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<ScheduledMovements>().RunAsync(stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                // Un giro fallito (es. database momentaneamente giù) non deve fermare i successivi.
                logger.LogError(e, "Generazione dei movimenti programmati fallita");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
