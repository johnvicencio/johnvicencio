using johnvicencio.Models;

namespace johnvicencio.Controllers;

public sealed class VaultController
{
    private readonly JsonContentService jsonContent;
    private readonly VaultCryptoService crypto;

    public VaultController(JsonContentService jsonContent, VaultCryptoService crypto)
    {
        this.jsonContent = jsonContent;
        this.crypto = crypto;
    }

    public async Task<VaultLoginResult> LoginAsync(string username, string passphrase)
    {
        var safeUsername = NormalizeUsername(username);
        if (string.IsNullOrWhiteSpace(safeUsername))
        {
            return VaultLoginResult.Fail("Enter a username.");
        }

        var vault = await jsonContent.ReadAsync<UserVault>($"data/users/{safeUsername}.json");
        if (vault is null)
        {
            return VaultLoginResult.Fail("Vault not found.");
        }

        try
        {
            var payload = await crypto.DecryptAsync(vault, passphrase);
            return VaultLoginResult.Success(vault, payload);
        }
        catch
        {
            return VaultLoginResult.Fail("Vault could not be unlocked.");
        }
    }

    private static string NormalizeUsername(string username)
    {
        var trimmed = username.Trim().ToLowerInvariant();
        return trimmed.All(character => char.IsLetterOrDigit(character) || character is '-' or '_')
            ? trimmed
            : string.Empty;
    }
}

public sealed class VaultLoginResult
{
    private VaultLoginResult(bool unlocked, string message, UserVault? vault, string? payload)
    {
        Unlocked = unlocked;
        Message = message;
        Vault = vault;
        Payload = payload;
    }

    public bool Unlocked { get; }

    public string Message { get; }

    public UserVault? Vault { get; }

    public string? Payload { get; }

    public static VaultLoginResult Success(UserVault vault, string payload)
    {
        return new VaultLoginResult(true, "Vault unlocked.", vault, payload);
    }

    public static VaultLoginResult Fail(string message)
    {
        return new VaultLoginResult(false, message, null, null);
    }
}
