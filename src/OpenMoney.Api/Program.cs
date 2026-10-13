using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenMoney.Api;
using OpenMoney.Infrastructure;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(UserEndpoints.AdminPolicy, policy => policy.RequireClaim(UserEndpoints.AdminClaim));
builder.Services
    .AddIdentityApiEndpoints<AppUser>(o => o.User.RequireUniqueEmail = true)
    .AddEntityFrameworkStores<AppDbContext>();

// Chiamate API non autenticate o non permesse: 401 e 403 invece del redirect a una pagina.
builder.Services.ConfigureApplicationCookie(o =>
{
    // Con "Resta collegato" la sessione dura tre mesi dall'ultimo utilizzo (di serie sarebbero due settimane).
    o.ExpireTimeSpan = TimeSpan.FromDays(90);
    o.Events.OnRedirectToLogin = ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    o.Events.OnRedirectToAccessDenied = ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

// Le chiavi cifrano il cookie di login: se non persistono, ogni riavvio del container fa uscire l'utente.
var keysPath = builder.Configuration["DataProtection:KeysPath"];
if (keysPath is not null)
    builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keysPath));

builder.Services.AddOpenApi();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();

// index.html punta ai bundle con hash nel nome: se resta in cache, dopo un rilascio il browser carica la versione vecchia.
var staticFiles = new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        if (ctx.File.Name == "index.html")
            ctx.Context.Response.Headers.CacheControl = "no-cache";
    }
};

app.UseDefaultFiles();
app.UseStaticFiles(staticFiles);
app.UseAuthentication();
app.UseAuthorization();

app.MapAuth();
app.MapProfile();
app.MapUsers();

// Documentazione interattiva (Scalar su /scalar): sempre in sviluppo, altrove solo su richiesta esplicita.
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("ApiDocs"))
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

// Le rotte /api sconosciute devono dare 404, non la pagina Angular.
app.Map("/api/{**rest}", () => Results.NotFound());
app.MapFallbackToFile("index.html", staticFiles);

app.Run();
