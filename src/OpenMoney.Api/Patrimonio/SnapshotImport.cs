using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Patrimonio;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api.Patrimonio;

/// <summary>
/// Importa uno storico di rilevazioni (per esempio da un foglio di calcolo) in un formato JSON con i nomi al posto
/// degli identificativi. Gestori e posizioni mancanti vengono creati; le date già presenti si saltano, così il file si
/// può importare di nuovo senza doppioni. O si importa tutto o niente.
/// </summary>
public static class SnapshotImport
{
    public sealed record ImportFile(IReadOnlyList<ImportSnapshot> Snapshots);

    public sealed record ImportSnapshot(DateOnly Date, IReadOnlyList<ImportHolding> Holdings, IReadOnlyList<ImportAccount> Accounts, string? Note);

    /// <param name="Portfolio">Il gestore; solo per gli investimenti.</param>
    public sealed record ImportHolding(string Name, HoldingKind Kind, string? Portfolio, decimal? Invested, decimal Value);

    public sealed record ImportAccount(string Name, decimal Balance);

    public sealed record ImportResult(int Imported, int Skipped);

    public static async Task<IResult> ImportAsync(ImportFile file, AppDbContext db, CancellationToken ct)
    {
        var existingDates = (await db.Snapshots.Select(s => s.Date).ToListAsync(ct)).ToHashSet();
        var portfolios = (await db.Portfolios.ToListAsync(ct)).ToDictionary(p => p.Name, StringComparer.OrdinalIgnoreCase);
        var holdings = (await db.Holdings.ToListAsync(ct)).ToDictionary(h => HoldingKey(h.Name, h.Kind, h.PortfolioId), StringComparer.OrdinalIgnoreCase);
        var accounts = (await db.Accounts.ToListAsync(ct)).GroupBy(a => a.Name, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);
        var created = new HashSet<Holding>();
        var toImport = file.Snapshots.Where(s => !existingDates.Contains(s.Date)).OrderBy(s => s.Date).ToList();

        foreach (var row in toImport)
        {
            var lines = new List<SnapshotHolding>();
            foreach (var item in row.Holdings)
            {
                var portfolioId = item.Kind == HoldingKind.Investment ? PortfolioFor(item.Portfolio, portfolios, db)?.Id : null;
                var values = new HoldingValues(item.Name, item.Kind, portfolioId, Closed: false).Normalized();
                if (Problems.From(values.Validate(portfolioExists: portfolioId is not null)) is { } problem)
                    return problem;

                var key = HoldingKey(values.Name!, values.Kind, values.PortfolioId);
                if (!holdings.TryGetValue(key, out var holding))
                {
                    holding = new Holding(values);
                    holdings[key] = holding;
                    created.Add(holding);
                    db.Holdings.Add(holding);
                }

                lines.Add(new SnapshotHolding(holding.Id, item.Invested, item.Value));
            }

            var snapshotValues = new SnapshotValues(
                row.Date,
                lines,
                [.. row.Accounts.Select(a => new SnapshotAccount(accounts.TryGetValue(a.Name.Trim(), out var id) ? id : null, a.Name, a.Balance))],
                row.Note).Normalized();
            if (Problems.From(snapshotValues.Validate()) is { } invalid)
                return invalid;

            db.Snapshots.Add(new Snapshot(snapshotValues));
        }

        // Le posizioni nuove che non compaiono nell'ultima rilevazione del file sono state vendute: si chiudono.
        var latest = toImport.LastOrDefault()?.Holdings.Select(h => h.Name.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];
        foreach (var holding in created.Where(h => !latest.Contains(h.Name)))
            holding.Update(new HoldingValues(holding.Name, holding.Kind, holding.PortfolioId, Closed: true));

        await db.SaveChangesAsync(ct);
        return Results.Ok(new ImportResult(toImport.Count, file.Snapshots.Count - toImport.Count));
    }

    private static Portfolio? PortfolioFor(string? name, Dictionary<string, Portfolio> portfolios, AppDbContext db)
    {
        if (Portfolio.CleanName(name) is not { } clean)
            return null;
        if (!portfolios.TryGetValue(clean, out var portfolio))
        {
            portfolio = new Portfolio(clean);
            portfolios[clean] = portfolio;
            db.Portfolios.Add(portfolio);
        }

        return portfolio;
    }

    private static string HoldingKey(string name, HoldingKind kind, Guid? portfolioId) => $"{kind}|{portfolioId}|{name.Trim()}";
}
