using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api;

/// <summary>Gestione degli utenti della famiglia, riservata all'amministratore.</summary>
public static class UserEndpoints
{
    public const string AdminPolicy = "Admin";
    public const string AdminClaim = "admin";

    public sealed record NewUser(string? Email, string? Password, string? DisplayName);

    public sealed record NewPassword(string? Password);

    public sealed record UserResponse(string Id, string? Email, string? DisplayName, bool IsAdmin);

    public static void MapUsers(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").RequireAuthorization(AdminPolicy);

        group.MapGet("", async (UserManager<AppUser> users) =>
        {
            var admins = (await users.GetUsersForClaimAsync(AdminMarker)).Select(u => u.Id).ToHashSet();
            var all = await users.Users.OrderBy(u => u.Email).ToListAsync();
            return all.Select(u => ToResponse(u, admins.Contains(u.Id)));
        });

        group.MapPost("", (NewUser request, UserManager<AppUser> users) => CreateAsync(users, request, isAdmin: false));

        group.MapPost("/{id}/password", async (string id, NewPassword request, UserManager<AppUser> users) =>
        {
            if (await users.FindByIdAsync(id) is not { } user)
                return Results.NotFound();

            // Non esiste il recupero via email: la password dimenticata la reimposta l'amministratore.
            var token = await users.GeneratePasswordResetTokenAsync(user);
            var reset = await users.ResetPasswordAsync(user, token, request.Password ?? "");
            return reset.Succeeded ? Results.NoContent() : Results.ValidationProblem(ToErrors(reset));
        });

        group.MapDelete("/{id}", async (string id, ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            // Senza questo controllo l'unico amministratore potrebbe chiudersi fuori da solo.
            if (id == users.GetUserId(principal))
                return Problems.Of("CannotDeleteSelf");
            if (await users.FindByIdAsync(id) is not { } user)
                return Results.NotFound();

            await users.DeleteAsync(user);
            return Results.NoContent();
        });
    }

    private static Claim AdminMarker => new(AdminClaim, "true");

    internal static async Task<IResult> CreateAsync(UserManager<AppUser> users, NewUser request, bool isAdmin)
    {
        var displayName = CleanDisplayName(request.DisplayName);
        if (ValidateDisplayName(displayName) is { } invalid)
            return invalid;

        var email = request.Email?.Trim();
        var user = new AppUser { UserName = email, Email = email, DisplayName = displayName };
        var created = await users.CreateAsync(user, request.Password ?? "");
        if (!created.Succeeded)
            return Results.ValidationProblem(ToErrors(created));

        if (isAdmin)
            await users.AddClaimAsync(user, AdminMarker);
        return Results.Ok(ToResponse(user, isAdmin));
    }

    internal static string? CleanDisplayName(string? raw) => string.IsNullOrWhiteSpace(raw) ? null : raw.Trim();

    internal static IResult? ValidateDisplayName(string? displayName) =>
        displayName?.Length > AppUser.DisplayNameMaxLength
            ? Problems.Of("DisplayNameTooLong")
            : null;

    // Le chiavi sono codici (qui quelli di Identity): il frontend li traduce.
    private static Dictionary<string, string[]> ToErrors(IdentityResult result) =>
        result.Errors.GroupBy(e => e.Code).ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());

    private static UserResponse ToResponse(AppUser user, bool isAdmin) => new(user.Id, user.Email, user.DisplayName, isAdmin);
}
