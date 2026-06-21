namespace johnvicencio.Models;

public sealed class SiteSetting
{
    public string SiteName { get; set; } = "";

    public string Tagline { get; set; } = "";

    public string AuthorName { get; set; } = "";

    public string ContactEmail { get; set; } = "";

    public string SmtpHost { get; set; } = "";

    public int SmtpPort { get; set; } = 587;

    public string SmtpUsername { get; set; } = "";

    public string SmtpPassword { get; set; } = "";

    public bool SmtpPasswordConfigured { get; set; }

    public string FromEmail { get; set; } = "";

    public string FromName { get; set; } = "";

    public string ToEmail { get; set; } = "";

    // Partials
    public List<CustomNavLink> NavLinks { get; set; } = [];
    public string FooterAboutHeader { get; set; } = "";
    public string FooterAbout { get; set; } = "";
    public List<CustomNavLink> FooterSections { get; set; } = [];
    public List<FooterConnect> FooterConnects { get; set; } = [];
}
