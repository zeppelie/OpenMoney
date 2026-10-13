using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace OpenMoney.Infrastructure;

public class AppUser : IdentityUser
{
    public const int DisplayNameMaxLength = 100;

    [MaxLength(DisplayNameMaxLength)]
    public string? DisplayName { get; set; }
}
