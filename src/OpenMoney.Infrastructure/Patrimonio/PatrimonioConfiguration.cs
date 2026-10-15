using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenMoney.Core.Patrimonio;

namespace OpenMoney.Infrastructure.Patrimonio;

public sealed class PortfolioConfiguration : IEntityTypeConfiguration<Portfolio>
{
    public void Configure(EntityTypeBuilder<Portfolio> builder)
    {
        builder.ToTable("Portfolios");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Name).HasMaxLength(Portfolio.NameMaxLength);
        builder.HasIndex(p => p.Name).IsUnique();
    }
}

public sealed class HoldingConfiguration : IEntityTypeConfiguration<Holding>
{
    public void Configure(EntityTypeBuilder<Holding> builder)
    {
        builder.ToTable("Holdings");
        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).ValueGeneratedNever();
        builder.Property(h => h.Name).HasMaxLength(HoldingValues.NameMaxLength);
        builder.Property(h => h.Kind).HasConversion<string>().HasMaxLength(20);

        // Un gestore con posizioni non si elimina: prima si spostano o si eliminano le posizioni.
        builder.HasOne<Portfolio>().WithMany().HasForeignKey(h => h.PortfolioId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class SnapshotConfiguration : IEntityTypeConfiguration<Snapshot>
{
    public void Configure(EntityTypeBuilder<Snapshot> builder)
    {
        builder.ToTable("Snapshots");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Note).HasMaxLength(SnapshotValues.NoteMaxLength);
        // Una sola fotografia per giorno.
        builder.HasIndex(s => s.Date).IsUnique();

        builder.OwnsMany(s => s.Holdings, holdings =>
        {
            holdings.ToTable("SnapshotHoldings");
            holdings.Property(h => h.Invested).HasPrecision(14, 2);
            holdings.Property(h => h.Value).HasPrecision(14, 2);
            // Una posizione che compare nello storico non si elimina: si chiude.
            holdings.HasOne<Holding>().WithMany().HasForeignKey(h => h.HoldingId).OnDelete(DeleteBehavior.Restrict);
        });

        // Il nome del conto è copiato nella fotografia: resta leggibile anche se il conto viene rinominato o eliminato.
        builder.OwnsMany(s => s.Accounts, accounts =>
        {
            accounts.ToTable("SnapshotAccounts");
            accounts.Property(a => a.Name).HasMaxLength(SnapshotAccount.NameMaxLength);
            accounts.Property(a => a.Balance).HasPrecision(14, 2);
        });
    }
}
