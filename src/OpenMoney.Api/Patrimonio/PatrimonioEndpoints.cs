using Microsoft.EntityFrameworkCore;
using OpenMoney.Api.Conti;
using OpenMoney.Core.Conti;
using OpenMoney.Core.Patrimonio;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Patrimonio;

/// <summary>Gestori, posizioni e rilevazioni mensili del patrimonio.</summary>
public static class PatrimonioEndpoints
{
    public sealed record PortfolioName(string? Name);

    /// <summary>I totali di una rilevazione, per l'andamento nel tempo.</summary>
    public sealed record SnapshotTotals(
        Guid Id, DateOnly Date, decimal Managed, decimal Liquidity, decimal Total, decimal PensionTotal, decimal DebtTotal, decimal NetWorth);

    public static void MapPatrimonio(this IEndpointRouteBuilder app)
    {
        MapPortfolios(app.MapGroup("/api/portfolios").RequireAuthorization());
        MapHoldings(app.MapGroup("/api/holdings").RequireAuthorization());
        MapSnapshots(app.MapGroup("/api/snapshots").RequireAuthorization());
    }

    private static void MapPortfolios(RouteGroupBuilder portfolios)
    {
        portfolios.MapGet("", async (AppDbContext db, CancellationToken ct) =>
            await db.Portfolios.OrderBy(p => p.Name).ToListAsync(ct));

        portfolios.MapPost("", async (PortfolioName request, AppDbContext db, CancellationToken ct) =>
        {
            if (await NameProblemAsync(request.Name, id: null, db, ct) is { } problem)
                return problem;

            var portfolio = new Portfolio(Portfolio.CleanName(request.Name)!);
            db.Portfolios.Add(portfolio);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/portfolios/{portfolio.Id}", new { portfolio.Id });
        });

        portfolios.MapPut("{id:guid}", async (Guid id, PortfolioName request, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Portfolios.FindAsync([id], ct) is not { } portfolio)
                return Results.NotFound();
            if (await NameProblemAsync(request.Name, id, db, ct) is { } problem)
                return problem;

            portfolio.Rename(Portfolio.CleanName(request.Name)!);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        portfolios.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Portfolios.FindAsync([id], ct) is not { } portfolio)
                return Results.NotFound();
            if (await db.Holdings.AnyAsync(h => h.PortfolioId == id, ct))
                return Problems.Of("PortfolioInUse");

            db.Portfolios.Remove(portfolio);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static void MapHoldings(RouteGroupBuilder holdings)
    {
        holdings.MapGet("", async (AppDbContext db, CancellationToken ct) =>
            await db.Holdings.OrderBy(h => h.Name).ToListAsync(ct));

        holdings.MapPost("", async (HoldingValues values, AppDbContext db, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (Problems.From(values.Validate(await PortfolioExistsAsync(values, db, ct))) is { } problem)
                return problem;

            var holding = new Holding(values);
            db.Holdings.Add(holding);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/holdings/{holding.Id}", new { holding.Id });
        });

        holdings.MapPut("{id:guid}", async (Guid id, HoldingValues values, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Holdings.FindAsync([id], ct) is not { } holding)
                return Results.NotFound();

            values = values.Normalized();
            if (Problems.From(values.Validate(await PortfolioExistsAsync(values, db, ct))) is { } problem)
                return problem;

            holding.Update(values);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        holdings.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Holdings.FindAsync([id], ct) is not { } holding)
                return Results.NotFound();
            if (await db.Snapshots.AnyAsync(s => s.Holdings.Any(h => h.HoldingId == id), ct))
                return Problems.Of("HoldingInUse");

            db.Holdings.Remove(holding);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static void MapSnapshots(RouteGroupBuilder snapshots)
    {
        snapshots.MapGet("", async (AppDbContext db, CancellationToken ct) =>
        {
            var (holdings, portfolios) = await LookupsAsync(db, ct);
            return (await db.Snapshots.OrderBy(s => s.Date).ToListAsync(ct))
                .Select(s => SnapshotSummary.From(s, holdings, portfolios))
                .Select(s => new SnapshotTotals(s.Id, s.Date, s.Managed, s.Liquidity, s.Total, s.PensionTotal, s.DebtTotal, s.NetWorth));
        });

        snapshots.MapGet("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Snapshots.FindAsync([id], ct) is not { } snapshot)
                return Results.NotFound();

            var (holdings, portfolios) = await LookupsAsync(db, ct);
            return Results.Ok(SnapshotSummary.From(snapshot, holdings, portfolios));
        });

        // I valori così come si modificano nel modulo.
        snapshots.MapGet("{id:guid}/values", async (Guid id, AppDbContext db, CancellationToken ct) =>
            await db.Snapshots.FindAsync([id], ct) is { } s
                ? Results.Ok(new SnapshotValues(s.Date, s.Holdings, s.Accounts, s.Note))
                : Results.NotFound());

        snapshots.MapGet("draft", async (DateOnly date, AppDbContext db, CancellationToken ct) =>
        {
            var previous = await db.Snapshots.Where(s => s.Date <= date).OrderByDescending(s => s.Date).FirstOrDefaultAsync(ct);
            var open = await db.Holdings.Where(h => !h.Closed).OrderBy(h => h.Name).ToListAsync(ct);
            var balances = await AccountBalances.LoadAsync(db, date, ct);
            // I conti del gruppo Investimenti restano fuori: il loro valore lo danno le posizioni, contarli due volte gonfierebbe il totale.
            var accounts = (await db.Accounts.Where(a => a.Group != AccountGroup.Investments).OrderBy(a => a.Name).ToListAsync(ct))
                .Select(a => (a.Id, a.Name, balances[a.Id]));
            return SnapshotValues.Draft(date, previous, open, accounts);
        });

        snapshots.MapPost("", async (SnapshotValues values, AppDbContext db, CancellationToken ct) =>
        {
            values = values.Normalized();
            if (await ProblemAsync(values, id: null, db, ct) is { } problem)
                return problem;

            var snapshot = new Snapshot(values);
            db.Snapshots.Add(snapshot);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/snapshots/{snapshot.Id}", new { snapshot.Id });
        });

        snapshots.MapPut("{id:guid}", async (Guid id, SnapshotValues values, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Snapshots.FindAsync([id], ct) is not { } snapshot)
                return Results.NotFound();

            values = values.Normalized();
            if (await ProblemAsync(values, id, db, ct) is { } problem)
                return problem;

            snapshot.Replace(values);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        snapshots.MapDelete("{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (await db.Snapshots.FindAsync([id], ct) is not { } snapshot)
                return Results.NotFound();

            db.Snapshots.Remove(snapshot);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        snapshots.MapPost("import", SnapshotImport.ImportAsync).RequireAuthorization(UserEndpoints.AdminPolicy);
    }

    internal static async Task<(Dictionary<Guid, Holding> Holdings, Dictionary<Guid, Portfolio> Portfolios)> LookupsAsync(
        AppDbContext db, CancellationToken ct) =>
        (await db.Holdings.ToDictionaryAsync(h => h.Id, ct), await db.Portfolios.ToDictionaryAsync(p => p.Id, ct));

    /// <param name="id">La rilevazione che si sta modificando; null se è nuova.</param>
    internal static async Task<IResult?> ProblemAsync(SnapshotValues values, Guid? id, AppDbContext db, CancellationToken ct)
    {
        var errors = values.Validate().ToList();

        var holdingIds = values.Holdings.Select(h => h.HoldingId).Distinct().ToList();
        if (await db.Holdings.CountAsync(h => holdingIds.Contains(h.Id), ct) < holdingIds.Count)
            errors.Add("UnknownHolding");

        var accountIds = values.Accounts.Select(a => a.AccountId).OfType<Guid>().Distinct().ToList();
        if (await db.Accounts.CountAsync(a => accountIds.Contains(a.Id), ct) < accountIds.Count)
            errors.Add("UnknownAccount");

        if (await db.Snapshots.AnyAsync(s => s.Date == values.Date && s.Id != id, ct))
            errors.Add("SnapshotDateTaken");

        return Problems.From(errors);
    }

    private static async Task<IResult?> NameProblemAsync(string? name, Guid? id, AppDbContext db, CancellationToken ct)
    {
        if (Portfolio.CleanName(name) is not { } clean)
            return Problems.Of("InvalidName");
        var lower = clean.ToLower();
        return await db.Portfolios.AnyAsync(p => p.Name.ToLower() == lower && p.Id != id, ct) ? Problems.Of("DuplicateName") : null;
    }

    private static async Task<bool> PortfolioExistsAsync(HoldingValues values, AppDbContext db, CancellationToken ct) =>
        values.PortfolioId is { } id && await db.Portfolios.AnyAsync(p => p.Id == id, ct);
}
