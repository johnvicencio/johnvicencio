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

    public string FromEmail { get; set; } = "";

    public string FromName { get; set; } = "";

    public string ToEmail { get; set; } = "";
}
