namespace johnvicencio.Models;

public sealed class Page
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];

    public string Slug { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Keywords { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public List<PageSection> Sections { get; set; } = [];
}
