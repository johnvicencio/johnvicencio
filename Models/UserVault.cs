namespace johnvicencio.Models;

public sealed class UserVault
{
    public string Username { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Algorithm { get; set; } = "AES-GCM";

    public string Kdf { get; set; } = "PBKDF2-HMAC-SHA256";

    public int Iterations { get; set; } = 600_000;

    public string Salt { get; set; } = string.Empty;

    public string Iv { get; set; } = string.Empty;

    public string CipherText { get; set; } = string.Empty;

    public string Tag { get; set; } = string.Empty;

    public bool RequiresSecondFactor { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
}
