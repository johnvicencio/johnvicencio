using System.Text.Json;
using johnvicencio.Models;
using Microsoft.JSInterop;

namespace johnvicencio.Controllers;

public sealed class VaultSessionService
{
    private const string StorageKeyVault = "jv_vault";
    private const string StorageKeyPayload = "jv_payload";

    public bool IsLoggedIn => Vault is not null;

    public UserVault? Vault { get; private set; }

    public string? Payload { get; private set; }

    public string? ReturnUrl { get; set; }

    public void SignIn(UserVault vault, string payload)
    {
        Vault = vault;
        Payload = payload;
    }

    public void SignOut()
    {
        Vault = null;
        Payload = null;
    }

    public async Task SignOutAsync(IJSRuntime js)
    {
        SignOut();
        await ClearStorageAsync(js);
    }

    public async Task PersistAsync(IJSRuntime js)
    {
        if (Vault is null || Payload is null) return;
        var vaultJson = JsonSerializer.Serialize(Vault);
        await js.InvokeVoidAsync("sessionStorage.setItem", StorageKeyVault, vaultJson);
        await js.InvokeVoidAsync("sessionStorage.setItem", StorageKeyPayload, Payload);
    }

    public async Task<bool> TryRestoreAsync(IJSRuntime js)
    {
        if (IsLoggedIn) return true;
        try
        {
            var vaultJson = await js.InvokeAsync<string>("sessionStorage.getItem", StorageKeyVault);
            var payload = await js.InvokeAsync<string>("sessionStorage.getItem", StorageKeyPayload);
            if (string.IsNullOrWhiteSpace(vaultJson) || string.IsNullOrWhiteSpace(payload)) return false;
            var vault = JsonSerializer.Deserialize<UserVault>(vaultJson);
            if (vault is null) return false;
            SignIn(vault, payload);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task ClearStorageAsync(IJSRuntime js)
    {
        await js.InvokeVoidAsync("sessionStorage.removeItem", StorageKeyVault);
        await js.InvokeVoidAsync("sessionStorage.removeItem", StorageKeyPayload);
    }
}
