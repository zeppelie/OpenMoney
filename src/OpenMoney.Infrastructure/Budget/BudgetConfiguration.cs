using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenMoney.Core.Budget;
using OpenMoney.Core.Categorie;

namespace OpenMoney.Infrastructure.Budget;

public sealed class BudgetConfiguration : IEntityTypeConfiguration<CategoryBudget>
{
    public void Configure(EntityTypeBuilder<CategoryBudget> builder)
    {
        builder.ToTable("Budgets");
        // Un solo budget per categoria: la categoria fa da chiave.
        builder.HasKey(b => b.CategoryId);
        builder.Property(b => b.CategoryId).ValueGeneratedNever();
        builder.Property(b => b.Amount).HasPrecision(12, 2);

        // Il budget non ha senso senza la sua categoria: se ne va con lei.
        builder.HasOne<Category>().WithOne().HasForeignKey<CategoryBudget>(b => b.CategoryId).OnDelete(DeleteBehavior.Cascade);
    }
}
