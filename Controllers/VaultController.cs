using System.Text.Json;
using johnvicencio.Models;

namespace johnvicencio.Controllers;

public sealed class VaultController
{
    private readonly JsonContentService jsonContent;
    private readonly DataStore store;
    private readonly VaultCryptoService crypto;

    public VaultController(JsonContentService jsonContent, DataStore store, VaultCryptoService crypto)
    {
        this.jsonContent = jsonContent;
        this.store = store;
        this.crypto = crypto;
    }

    public async Task<VaultLoginResult> LoginAsync(string username, string passphrase)
    {
        var safeUsername = NormalizeUsername(username);
        if (string.IsNullOrWhiteSpace(safeUsername))
        {
            return VaultLoginResult.Fail("Enter a username.");
        }

        var vault = await store.LoadSingleAsync<UserVault>($"users/{safeUsername}");
        vault ??= await jsonContent.ReadAsync<UserVault>($"data/users/{safeUsername}.json");
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

    public async Task<VaultChangePasswordResult> ChangePasswordAsync(
        string currentPassphrase, string newPassphrase)
    {
        var loginResult = await LoginAsync("admin", currentPassphrase);
        if (!loginResult.Unlocked || loginResult.Vault is null || loginResult.Payload is null)
        {
            return VaultChangePasswordResult.Fail("Current password is incorrect.");
        }

        try
        {
            var (salt, iv, cipherText, tag, iterations) =
                await crypto.EncryptAsync(loginResult.Payload, newPassphrase);

            var vault = loginResult.Vault;
            vault.Salt = salt;
            vault.Iv = iv;
            vault.CipherText = cipherText;
            vault.Tag = tag;
            vault.Iterations = iterations;

            await store.SaveAsync(vault, "users/admin");
            return VaultChangePasswordResult.Ok("Password changed successfully.");
        }
        catch
        {
            return VaultChangePasswordResult.Fail("Could not change password. Try again.");
        }
    }

    public async Task<VaultChangePasswordResult> GenerateResetVaultAsync(string newPassphrase)
    {
        var payload = JsonSerializer.Serialize(new { username = "admin", role = "admin" });

        try
        {
            var (salt, iv, cipherText, tag, iterations) =
                await crypto.EncryptAsync(payload, newPassphrase);

            var vault = new UserVault
            {
                Username = "admin",
                DisplayName = "Admin",
                Algorithm = "AES-GCM",
                Kdf = "PBKDF2-HMAC-SHA256",
                Iterations = iterations,
                Salt = salt,
                Iv = iv,
                CipherText = cipherText,
                Tag = tag,
                CreatedUtc = DateTimeOffset.UtcNow
            };

            await store.SaveAsync(vault, "users/admin");
            return VaultChangePasswordResult.Ok("Password reset successfully.");
        }
        catch
        {
            return VaultChangePasswordResult.Fail("Could not reset password. Try again.");
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

public sealed class VaultChangePasswordResult
{
    private VaultChangePasswordResult(bool success, string message)
    {
        Success = success;
        Message = message;
    }

    public bool Success { get; }

    public string Message { get; }

    public static VaultChangePasswordResult Ok(string message)
    {
        return new VaultChangePasswordResult(true, message);
    }

    public static VaultChangePasswordResult Fail(string message)
    {
        return new VaultChangePasswordResult(false, message);
    }
}
