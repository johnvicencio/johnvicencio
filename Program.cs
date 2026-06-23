using johnvicencio;
using johnvicencio.Controllers;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.JSInterop;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddSingleton(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddSingleton<DataStore>();
builder.Services.AddSingleton<PageController>();
builder.Services.AddSingleton<BlogController>();
builder.Services.AddSingleton<ContactMessageController>();
builder.Services.AddSingleton<ImageAssetController>();
builder.Services.AddSingleton<SiteController>();
builder.Services.AddSingleton<RouterController>();
builder.Services.AddSingleton<JsonContentService>();
builder.Services.AddSingleton<VaultCryptoService>();
builder.Services.AddSingleton<VaultController>();
builder.Services.AddSingleton<LogService>(sp => new LogService(
    sp.GetRequiredService<HttpClient>(),
    sp.GetRequiredService<IJSRuntime>()));
builder.Services.AddSingleton<VaultSessionService>();

await builder.Build().RunAsync();
