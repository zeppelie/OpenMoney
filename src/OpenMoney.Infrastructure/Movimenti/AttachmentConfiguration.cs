using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenMoney.Core.Movimenti;

namespace OpenMoney.Infrastructure.Movimenti;

public sealed class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> builder)
    {
        builder.ToTable("Attachments");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.FileName).HasMaxLength(Attachment.FileNameMaxLength);
        builder.Property(a => a.ContentType).HasMaxLength(50);

        // Gli allegati seguono il loro movimento (i file sul disco li toglie l'endpoint che elimina il movimento).
        builder.HasOne<Movement>().WithMany().HasForeignKey(a => a.MovementId).OnDelete(DeleteBehavior.Cascade);
    }
}
