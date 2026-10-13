using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenMoney.Infrastructure;

namespace OpenMoney.Api;

public static class AuthEndpoints
{
    public static void MapAuth(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/auth");

        // Login e cambio password li fornisce Identity. La registrazione libera non esiste: gli utenti li crea l'amministratore.
        auth.MapIdentityApi<AppUser>().AddEndpointFilter(async (ctx, next) =>
            ctx.HttpContext.Request.Path.Value?.EndsWith("/register", StringComparison.OrdinalIgnoreCase) == true
                ? Results.StatusCode(StatusCodes.Status403Forbidden)
                : await next(ctx));

        auth.MapGet("/status", async (UserManager<AppUser> users) =>
            new { setupRequired = !await users.Users.AnyAsync() });

        // Primo avvio: chi apre l'app per primo crea l'amministratore; poi questa porta si chiude.
        auth.MapPost("/setup", async (UserEndpoints.NewUser request, UserManager<AppUser> users) =>
            await users.Users.AnyAsync()
                ? Results.StatusCode(StatusCodes.Status403Forbidden)
                : await UserEndpoints.CreateAsync(users, request, isAdmin: true));

        auth.MapPost("/logout", async (SignInManager<AppUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        }).RequireAuthorization();
    }
}
