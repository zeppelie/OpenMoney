using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenMoney.Core.Categorie;
using OpenMoney.Core.Conti;
using OpenMoney.Core.Movimenti;
using OpenMoney.Core.Ricorrenze;

namespace OpenMoney.Infrastructure.Ricorrenze;

public sealed class RecurrenceConfiguration : IEntityTypeConfiguration<Recurrence>
{
    public void Configure(EntityTypeBuilder<Recurrence> builder)
    {
        builder.ToTable("Recurrences");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Frequency).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.Amount).HasPrecision(12, 2);
        builder.Property(r => r.Note).HasMaxLength(MovementValues.NoteMaxLength);
        builder.Ignore(r => r.NextDate);

        // Come per i movimenti: conti e categorie in uso non si eliminano.
        builder.HasOne<Account>().WithMany().HasForeignKey(r => r.AccountId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Account>().WithMany().HasForeignKey(r => r.ToAccountId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Category>().WithMany().HasForeignKey(r => r.CategoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>().WithMany().HasForeignKey(r => r.AuthorId).OnDelete(DeleteBehavior.SetNull);
    }
}
