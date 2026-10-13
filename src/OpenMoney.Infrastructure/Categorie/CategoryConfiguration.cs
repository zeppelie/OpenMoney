using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenMoney.Core.Categorie;

namespace OpenMoney.Infrastructure.Categorie;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Name).HasMaxLength(CategoryValues.NameMaxLength);
        builder.Property(c => c.Kind).HasConversion<string>().HasMaxLength(20);

        // Una categoria con sottocategorie non si elimina: prima vanno spostate o eliminate quelle.
        builder.HasOne<Category>().WithMany().HasForeignKey(c => c.ParentId).OnDelete(DeleteBehavior.Restrict);
    }
}
