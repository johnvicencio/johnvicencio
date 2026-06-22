namespace johnvicencio.Models;

public sealed class PageSection
{
    public string SectionId { get; set; } = "";

    public string? AnchorId { get; set; }

    public string Type { get; set; } = "content";

    public string Heading { get; set; } = "";

    public string Body { get; set; } = "";

    public string? Icon { get; set; }

    public string? ActionText { get; set; }

    public string? ActionUrl { get; set; }

    public string? ImageUrl { get; set; }

    public string? ImageAlt { get; set; }

    public bool ImageFullWidth { get; set; } = true;

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

    public string? Subtitle { get; set; }

    public string Body { get; set; } = "";

    public string? ImageUrl { get; set; }

    public string? ImageAlt { get; set; }

    public string? ImageLink { get; set; }

    public bool ImageLinkNewTab { get; set; }

    public string? ActionText { get; set; }

    public string? ActionUrl { get; set; }

    public bool ActionNewTab { get; set; }

    public string? ActionIcon { get; set; }
}
