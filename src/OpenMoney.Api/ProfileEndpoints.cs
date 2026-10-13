using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api;

public static class ProfileEndpoints
{
    public sealed record ProfileResponse(string? Email, string? DisplayName, bool IsAdmin);

    public sealed record ProfileUpdate(string? DisplayName);

    public static void MapProfile(this IEndpointRouteBuilder app)
    {
        var profile = app.MapGroup("/api/profile").RequireAuthorization();

        profile.MapGet("", async (ClaimsPrincipal principal, UserManager<AppUser> users) =>
            await users.GetUserAsync(principal) is { } user ? Results.Ok(ToResponse(user, principal)) : Results.Unauthorized());

        profile.MapPut("", async (ProfileUpdate update, ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            if (await users.GetUserAsync(principal) is not { } user)
                return Results.Unauthorized();

            var displayName = UserEndpoints.CleanDisplayName(update.DisplayName);
            if (UserEndpoints.ValidateDisplayName(displayName) is { } invalid)
                return invalid;

            user.DisplayName = displayName;
            await users.UpdateAsync(user);
            return Results.Ok(ToResponse(user, principal));
        });
    }

    private static ProfileResponse ToResponse(AppUser user, ClaimsPrincipal principal) =>
        new(user.Email, user.DisplayName, principal.HasClaim(c => c.Type == UserEndpoints.AdminClaim));
}
