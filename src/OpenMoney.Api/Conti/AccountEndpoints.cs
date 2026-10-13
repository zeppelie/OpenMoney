using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Conti;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Conti;

public static class AccountEndpoints
{
    public sealed record AccountResponse(Guid Id, string Name, AccountGroup Group, decimal InitialBalance, decimal Balance);

    public sealed record AccountsResponse(NetWorth NetWorth, IReadOnlyList<AccountResponse> Accounts);

    public static void MapAccounts(this IEndpointRouteBuilder app)
    {
        var accounts = app.MapGroup("/api/accounts").RequireAuthorization();

        accounts.MapGet("", async (AppDbContext db, CancellationToken ct) =>
        {
            var all = await db.Accounts.OrderBy(a => a.Name).ToListAsync(ct);
            var fromAccount = (await db.Movements
                    .GroupBy(m => new { m.AccountId, m.Kind })
                    .Select(g => new { g.Key.AccountId, g.Key.Kind, Total = g.Sum(m => m.Amount) })
                    .ToListAsync(ct))
                .ToLookup(t => t.AccountId, t => (t.Kind, t.Total));
            var transfersIn = await db.Movements
                .Where(m => m.ToAccountId != null)
                .GroupBy(m => m.ToAccountId!.Value)
                .Select(g => new { AccountId = g.Key, Total = g.Sum(m => m.Amount) })
                .ToDictionaryAsync(t => t.AccountId, t => t.Total, ct);

            var responses = all
                .Select(a => new AccountResponse(
                    a.Id, a.Name, a.Group, a.InitialBalance,
                    Balances.Of(a.InitialBalance, fromAccount[a.Id], transfersIn.GetValueOrDefault(a.Id))))
                .ToList();
            return new AccountsResponse(NetWorth.From(responses.Select(a => a.Balance)), responses);
        });

        accounts.MapPost("", async (AccountValues values, AppDbContext db, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (Problems.From(values.Validate()) is { } problem)
                return problem;

            var account = new Account(values);
            db.Accounts.Add(account);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/accounts/{account.Id}", new { account.Id });
        });

        accounts.MapPut("{id:guid}", async (Guid id, AccountValues values, AppDbContext db, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (Problems.From(values.Validate()) is { } problem)
                return problem;
            if (await db.Accounts.FindAsync([id], ct) is not { } account)
                return Results.NotFound();

            account.Update(values);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        accounts.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Accounts.FindAsync([id], ct) is not { } account)
                return Results.NotFound();
            if (await db.Movements.AnyAsync(m => m.AccountId == id || m.ToAccountId == id, ct))
                return Problems.Of("AccountInUse");

            db.Accounts.Remove(account);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
