using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Conti;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Conti;

public static class AccountEndpoints
{
    public sealed record AccountResponse(
        Guid Id, string Name, AccountGroup Group, decimal InitialBalance, Guid? SettlementAccountId, int? SettlementDay,
        decimal Balance);

    public sealed record AccountsResponse(NetWorth NetWorth, IReadOnlyList<AccountResponse> Accounts);

    public static void MapAccounts(this IEndpointRouteBuilder app)
    {
        var accounts = app.MapGroup("/api/accounts").RequireAuthorization();

        accounts.MapGet("", async (AppDbContext db, CancellationToken ct) =>
        {
            var balances = await AccountBalances.LoadAsync(db, upTo: null, ct);
            var responses = (await db.Accounts.OrderBy(a => a.Name).ToListAsync(ct))
                .Select(a => new AccountResponse(
                    a.Id, a.Name, a.Group, a.InitialBalance, a.SettlementAccountId, a.SettlementDay, balances[a.Id]))
                .ToList();
            return new AccountsResponse(NetWorth.From(responses.Select(a => a.Balance)), responses);
        });

        accounts.MapPost("", async (AccountValues values, AppDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (await ProblemAsync(values, id: null, db, ct) is { } problem)
                return problem;

            var account = new Account(values, time.Today());
            db.Accounts.Add(account);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/accounts/{account.Id}", new { account.Id });
        });

        accounts.MapPut("{id:guid}", async (Guid id, AccountValues values, AppDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (await ProblemAsync(values, id, db, ct) is { } problem)
                return problem;
            if (await db.Accounts.FindAsync([id], ct) is not { } account)
                return Results.NotFound();

            account.Update(values, time.Today());
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        accounts.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Accounts.FindAsync([id], ct) is not { } account)
                return Results.NotFound();
            if (await db.Movements.AnyAsync(m => m.AccountId == id || m.ToAccountId == id, ct)
                || await db.Recurrences.AnyAsync(r => r.AccountId == id || r.ToAccountId == id, ct)
                || await db.Accounts.AnyAsync(a => a.SettlementAccountId == id, ct))
                return Problems.Of("AccountInUse");

            db.Accounts.Remove(account);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    /// <param name="id">Il conto che si sta modificando; null se è nuovo.</param>
    private static async Task<IResult?> ProblemAsync(AccountValues values, Guid? id, AppDbContext db, CancellationToken ct)
    {
        var errors = values.Validate().ToList();
        if (values.SettlementAccountId is { } settlementId)
        {
            if (settlementId == id) errors.Add("SameAccount");
            else if (!await db.Accounts.AnyAsync(a => a.Id == settlementId, ct)) errors.Add("UnknownAccount");
        }

        return Problems.From(errors);
    }
}
