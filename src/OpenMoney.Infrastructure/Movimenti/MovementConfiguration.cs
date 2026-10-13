using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenMoney.Core.Categorie;
using OpenMoney.Core.Conti;
using OpenMoney.Core.Movimenti;

namespace OpenMoney.Infrastructure.Movimenti;

public sealed class MovementConfiguration : IEntityTypeConfiguration<Movement>
{
    public void Configure(EntityTypeBuilder<Movement> builder)
    {
        builder.ToTable("Movements");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(m => m.Amount).HasPrecision(12, 2);
        builder.Property(m => m.Note).HasMaxLength(MovementValues.NoteMaxLength);

        // Le viste leggono sempre un intervallo di date.
        builder.HasIndex(m => m.Date);

        // Conti e categorie con movimenti non si eliminano: sparirebbe la storia.
        builder.HasOne<Account>().WithMany().HasForeignKey(m => m.AccountId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Account>().WithMany().HasForeignKey(m => m.ToAccountId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Category>().WithMany().HasForeignKey(m => m.CategoryId).OnDelete(DeleteBehavior.Restrict);

        // I movimenti sono della famiglia: restano anche se chi li ha inseriti viene eliminato.
        builder.HasOne<AppUser>().WithMany().HasForeignKey(m => m.AuthorId).OnDelete(DeleteBehavior.SetNull);
    }
}
