using System.Text;

namespace johnvicencio.Controllers;

public static class SlugHelper
{
    public static string ToSlug(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return string.Empty;
        var slug = new StringBuilder();
        foreach (var c in title.ToLowerInvariant().Trim())
        {
            if (char.IsLetterOrDigit(c))
                slug.Append(c);
            else if (c is ' ' or '-')
                slug.Append('-');
        }
        var result = slug.ToString().Trim('-');
        while (result.Contains("--")) result = result.Replace("--", "-");
        return result;
    }

    public static string SectionTypeDisplayName(string? type) => type switch
    {
        "hero" => "Hero",
        "2-col" => "2-Column",
        "3-col" => "3-Column",
        "cards" or "cardcollection" or "row-card" => "Row Card",
        "grid-card" or "portfolio" => "Grid Card",
        "content" => "Content",
        "contact" => "Contact",
        _ => "",
    };
}
