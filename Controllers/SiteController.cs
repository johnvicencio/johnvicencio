using johnvicencio.Models;

namespace johnvicencio.Controllers;

public sealed class SiteController
{
    private const string ContentName = "settings";

    private readonly DataStore store;
    private SiteSetting? cached;

    public SiteController(DataStore store)
    {
        this.store = store;
    }

    public async Task<SiteSetting> GetSettingsAsync()
    {
        cached ??= await store.LoadSingleAsync<SiteSetting>(ContentName) ?? new SiteSetting();
        return cached;
    }

    public async Task UpdateSettingsAsync(SiteSetting settings)
    {
        cached = settings;
        await store.SaveAsync(settings, ContentName);
    }
}
