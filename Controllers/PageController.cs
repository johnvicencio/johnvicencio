using johnvicencio.Models;

namespace johnvicencio.Controllers;

public sealed class PageController
{
    private const string ContentName = "pages";

    private readonly DataStore store;
    private List<Page>? pages;

    public PageController(DataStore store)
    {
        this.store = store;
    }

    public async Task<List<Page>> GetPagesAsync()
    {
        pages ??= await store.LoadAsync<Page>(ContentName);
        return pages;
    }

    public async Task<Page?> GetPageAsync(string slug)
    {
        var all = await GetPagesAsync();
        return all.FirstOrDefault(p => p.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<Page?> GetPageByIdAsync(string id)
    {
        var all = await GetPagesAsync();
        return all.FirstOrDefault(p => p.Id == id);
    }

    public async Task AddPageAsync(Page page)
    {
        var all = await GetPagesAsync();
        all.Add(page);
        await store.SaveAsync(all, ContentName);
    }

    public async Task UpdatePageAsync(Page page)
    {
        var all = await GetPagesAsync();
        var index = all.FindIndex(p => p.Id == page.Id);
        if (index >= 0)
            all[index] = page;
        await store.SaveAsync(all, ContentName);
    }

    public async Task DeletePageAsync(string pageId)
    {
        var all = await GetPagesAsync();
        all.RemoveAll(p => p.Id == pageId);
        await store.SaveAsync(all, ContentName);
    }
}
