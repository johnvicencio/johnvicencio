namespace johnvicencio.Models;

public sealed class PageSection
{
    public string SectionId { get; set; } = "";

    public string Type { get; set; } = "content";

    public string Heading { get; set; } = "";

    public string Body { get; set; } = "";

    public string? ActionText { get; set; }

    public string? ActionUrl { get; set; }

    public string? ImageUrl { get; set; }

    public string? ImageAlt { get; set; }

    public List<SectionButton> Buttons { get; set; } = [];

    public List<SectionColumn> Columns { get; set; } = [];
}

public sealed class SectionButton
{
    public string Icon { get; set; } = "";

    public string Text { get; set; } = "";

    public string Url { get; set; } = "";
}

public sealed class SectionColumn
{
    public string Title { get; set; } = "";

    public string Body { get; set; } = "";

    public string? ActionText { get; set; }

    public string? ActionUrl { get; set; }
}
