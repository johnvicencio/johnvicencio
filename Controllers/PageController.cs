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

    public event Action? PagesChanged;

    public async Task<List<Page>> GetPagesAsync()
    {
        pages ??= await store.LoadAsync<Page>(ContentName);
        NormalizeSortOrder(pages);
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
        if (all.Any(p => p.Slug.Equals(page.Slug, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"A page with slug '{page.Slug}' already exists.");

        page.SortOrder = page.Slug.Equals("home", StringComparison.OrdinalIgnoreCase)
            ? 0
            : all.Where(p => !p.Slug.Equals("home", StringComparison.OrdinalIgnoreCase)).Select(p => p.SortOrder).DefaultIfEmpty(0).Max() + 1;

        var updated = new List<Page>(all) { page };
        await store.SaveAsync(updated, ContentName);
        pages = updated;
        PagesChanged?.Invoke();
    }

    public async Task UpdatePageAsync(Page page)
    {
        var all = await GetPagesAsync();
        if (all.Any(p => p.Id != page.Id && p.Slug.Equals(page.Slug, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"A page with slug '{page.Slug}' already exists.");

        var updated = new List<Page>(all);
        var index = updated.FindIndex(p => p.Id == page.Id);
        if (index >= 0)
            updated[index] = page;
        await store.SaveAsync(updated, ContentName);
        pages = updated;
        PagesChanged?.Invoke();
    }

    public async Task DeletePageAsync(string pageId)
    {
        var all = await GetPagesAsync();
        var updated = new List<Page>(all);
        updated.RemoveAll(p => p.Id == pageId);
        await store.SaveAsync(updated, ContentName);
        pages = updated;
        PagesChanged?.Invoke();
    }

    public async Task MovePageAsync(string pageId, int direction)
    {
        var all = await GetPagesAsync();
        var movable = all
            .Where(p => !p.Slug.Equals("home", StringComparison.OrdinalIgnoreCase) && !IsLegalPage(p.Slug))
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Title)
            .ToList();

        var index = movable.FindIndex(p => p.Id == pageId);
        if (index < 0) return;

        var newIndex = index + direction;
        if (newIndex < 0 || newIndex >= movable.Count) return;

        (movable[index], movable[newIndex]) = (movable[newIndex], movable[index]);
        for (var i = 0; i < movable.Count; i++)
        {
            movable[i].SortOrder = i + 1;
        }

        var updated = all.Select(page => movable.FirstOrDefault(p => p.Id == page.Id) ?? page).ToList();
        await store.SaveAsync(updated, ContentName);
        pages = updated;
        PagesChanged?.Invoke();
    }

    private static void NormalizeSortOrder(List<Page> pageList)
    {
        var next = 1;
        foreach (var page in pageList.Where(p => p.Slug.Equals("home", StringComparison.OrdinalIgnoreCase)))
        {
            page.SortOrder = 0;
        }

        foreach (var page in pageList.Where(p => !p.Slug.Equals("home", StringComparison.OrdinalIgnoreCase) && !IsLegalPage(p.Slug)).OrderBy(p => p.SortOrder == 0 ? int.MaxValue : p.SortOrder).ThenBy(p => p.Title))
        {
            page.SortOrder = next++;
        }
    }

    private static bool IsLegalPage(string slug) =>
        slug.Equals("terms-and-conditions", StringComparison.OrdinalIgnoreCase) ||
        slug.Equals("privacy-policy", StringComparison.OrdinalIgnoreCase);
}
