using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OpenMoney.Core.Budget;
using OpenMoney.Core.Categorie;
using OpenMoney.Core.Conti;
using OpenMoney.Core.Modelli;
using OpenMoney.Core.Movimenti;
using OpenMoney.Core.Ricorrenze;

namespace OpenMoney.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options)
    : IdentityDbContext<AppUser>(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Movement> Movements => Set<Movement>();
    public DbSet<CategoryBudget> Budgets => Set<CategoryBudget>();
    public DbSet<Recurrence> Recurrences => Set<Recurrence>();
    public DbSet<MovementTemplate> Templates => Set<MovementTemplate>();
    public DbSet<Attachment> Attachments => Set<Attachment>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
