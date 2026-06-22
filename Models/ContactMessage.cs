namespace johnvicencio.Models;

public sealed class ContactMessage
{
    public string Id { get; set; } = "";

    public string Name { get; set; } = "";

    public string Email { get; set; } = "";

    public string Message { get; set; } = "";

    public DateTimeOffset SubmittedUtc { get; set; }

    public bool IsRead { get; set; }
}
