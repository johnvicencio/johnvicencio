namespace johnvicencio.Models;

public sealed class BlogPost
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];

    public string Slug { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Keywords { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public DateOnly PublishedOn { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
}
