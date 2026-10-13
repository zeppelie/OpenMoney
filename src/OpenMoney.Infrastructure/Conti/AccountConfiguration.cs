using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenMoney.Core.Conti;

namespace OpenMoney.Infrastructure.Conti;

public sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("Accounts");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Name).HasMaxLength(AccountValues.NameMaxLength);
        builder.Property(a => a.Group).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.InitialBalance).HasPrecision(12, 2);
    }
}
