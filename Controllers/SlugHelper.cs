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
}
