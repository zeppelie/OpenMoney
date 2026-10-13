using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Conti;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Conti;

internal static class AccountBalances
{
    /// <summary>Saldo di ogni conto contando i movimenti fino a <paramref name="upTo"/> compreso; tutti se è null.</summary>
    public static async Task<Dictionary<Guid, decimal>> LoadAsync(AppDbContext db, DateOnly? upTo, CancellationToken ct)
    {
        var movements = upTo is { } date ? db.Movements.Where(m => m.Date <= date) : db.Movements;

        var fromAccount = (await movements
                .GroupBy(m => new { m.AccountId, m.Kind })
                .Select(g => new { g.Key.AccountId, g.Key.Kind, Total = g.Sum(m => m.Amount) })
                .ToListAsync(ct))
            .ToLookup(t => t.AccountId, t => (t.Kind, t.Total));
        var transfersIn = await movements
            .Where(m => m.ToAccountId != null)
            .GroupBy(m => m.ToAccountId!.Value)
            .Select(g => new { AccountId = g.Key, Total = g.Sum(m => m.Amount) })
            .ToDictionaryAsync(t => t.AccountId, t => t.Total, ct);
        var initial = await db.Accounts.Select(a => new { a.Id, a.InitialBalance }).ToListAsync(ct);

        return initial.ToDictionary(
            a => a.Id,
            a => Balances.Of(a.InitialBalance, fromAccount[a.Id], transfersIn.GetValueOrDefault(a.Id)));
    }
}
