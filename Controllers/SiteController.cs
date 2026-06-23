using johnvicencio.Models;

namespace johnvicencio.Controllers;

public sealed class SiteController
{
    private const string ContentName = "settings";

    private readonly DataStore store;
    private readonly LogService log;
    private SiteSetting? cached;

    public event Action? SettingsChanged;

    public SiteController(DataStore store, LogService log)
    {
        this.store = store;
        this.log = log;
    }

    public async Task<SiteSetting> GetSettingsAsync()
    {
        cached ??= await store.LoadSingleAsync<SiteSetting>(ContentName) ?? new SiteSetting();
        return cached;
    }

    public async Task UpdateSettingsAsync(SiteSetting settings)
    {
        await store.SaveAsync(settings, ContentName);
        cached = settings;
        await log.InfoAsync("SiteController", "Settings updated");
        SettingsChanged?.Invoke();
    }
}
