using johnvicencio.Models;
using Microsoft.JSInterop;

namespace johnvicencio.Controllers;

public sealed class VaultCryptoService
{
    private const int MinimumPassphraseLength = 10;
    private readonly IJSRuntime jsRuntime;

    public VaultCryptoService(IJSRuntime jsRuntime)
    {
        this.jsRuntime = jsRuntime;
    }

    public async Task<string> DecryptAsync(UserVault vault, string passphrase)
    {
        if (string.IsNullOrWhiteSpace(passphrase) || passphrase.Length < MinimumPassphraseLength)
        {
            throw new InvalidOperationException($"Passphrase must be at least {MinimumPassphraseLength} characters.");
        }

        if (!vault.Algorithm.Equals("AES-GCM", StringComparison.OrdinalIgnoreCase) ||
            !vault.Kdf.Equals("PBKDF2-HMAC-SHA256", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Unsupported vault encryption settings.");
        }

        return await jsRuntime.InvokeAsync<string>(
            "johnvicencioVault.decrypt",
            vault.Salt,
            vault.Iv,
            vault.CipherText,
            vault.Tag,
            vault.Iterations,
            passphrase);
    }

    public async Task<(string Salt, string Iv, string CipherText, string Tag, int Iterations)> EncryptAsync(
        string payload, string passphrase)
    {
        if (string.IsNullOrWhiteSpace(passphrase) || passphrase.Length < MinimumPassphraseLength)
        {
            throw new InvalidOperationException($"Passphrase must be at least {MinimumPassphraseLength} characters.");
        }

        var result = await jsRuntime.InvokeAsync<EncryptResult>(
            "johnvicencioVault.encrypt", payload, passphrase);

        return (result.Salt, result.Iv, result.CipherText, result.Tag, result.Iterations);
    }

    private sealed class EncryptResult
    {
        public string Salt { get; set; } = "";
        public string Iv { get; set; } = "";
        public string CipherText { get; set; } = "";
        public string Tag { get; set; } = "";
        public int Iterations { get; set; }
    }
}
