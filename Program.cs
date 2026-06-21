using johnvicencio;
using johnvicencio.Controllers;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<AppEnvironment>();
builder.Services.AddScoped<DataStore>();
builder.Services.AddScoped<PageController>();
builder.Services.AddScoped<BlogController>();
builder.Services.AddScoped<ContactMessageController>();
builder.Services.AddScoped<ImageAssetController>();
builder.Services.AddScoped<SiteController>();
builder.Services.AddScoped<RouterController>();
builder.Services.AddScoped<JsonContentService>();
builder.Services.AddScoped<VaultCryptoService>();
builder.Services.AddScoped<VaultController>();
builder.Services.AddSingleton<VaultSessionService>();
builder.Services.AddScoped<RouteService>();

await builder.Build().RunAsync();
