using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenMoney.Core.Categorie;
using OpenMoney.Core.Conti;
using OpenMoney.Core.Modelli;
using OpenMoney.Core.Movimenti;

namespace OpenMoney.Infrastructure.Modelli;

public sealed class MovementTemplateConfiguration : IEntityTypeConfiguration<MovementTemplate>
{
    public void Configure(EntityTypeBuilder<MovementTemplate> builder)
    {
        builder.ToTable("MovementTemplates");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Name).HasMaxLength(TemplateValues.NameMaxLength);
        builder.Property(t => t.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.Amount).HasPrecision(12, 2);
        builder.Property(t => t.Note).HasMaxLength(MovementValues.NoteMaxLength);

        // Un modello è una scorciatoia: se sparisce il conto o la categoria che usa, sparisce anche lui.
        builder.HasOne<Account>().WithMany().HasForeignKey(t => t.AccountId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Account>().WithMany().HasForeignKey(t => t.ToAccountId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Category>().WithMany().HasForeignKey(t => t.CategoryId).OnDelete(DeleteBehavior.Cascade);
    }
}
