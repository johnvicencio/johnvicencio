using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.JSInterop;

namespace johnvicencio.Controllers;

public sealed class DataStore
{
    private readonly HttpClient http;
    private readonly IJSRuntime? js;

    public DataStore(HttpClient http, IJSRuntime? js = null)
    {
        this.http = http;
        this.js = js;
    }

    public async Task<List<T>> LoadAsync<T>(string jsonUrl, string storageKey) where T : class
    {
        try
        {
            var fromBlob = await http.GetFromJsonAsync<List<T>>(NetlifyContentUrl(storageKey));
            if (fromBlob is not null) return fromBlob;
        }
        catch { }

        try
        {
            var fromFile = await http.GetFromJsonAsync<List<T>>(jsonUrl);
            if (fromFile is not null) return fromFile;
        }
        catch { }

        return await FallbackReadAsync<List<T>>(storageKey) ?? [];
    }

    public async Task<T?> LoadSingleAsync<T>(string jsonUrl, string storageKey) where T : class
    {
        try
        {
            var fromBlob = await http.GetFromJsonAsync<T>(NetlifyContentUrl(storageKey));
            if (fromBlob is not null) return fromBlob;
        }
        catch { }

        try
        {
            var fromFile = await http.GetFromJsonAsync<T>(jsonUrl);
            if (fromFile is not null) return fromFile;
        }
        catch { }

        return await FallbackReadAsync<T>(storageKey);
    }

    public async Task SaveAsync<T>(T data, string storageKey)
    {
        try
        {
            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
            using var request = new HttpRequestMessage(HttpMethod.Put, NetlifyContentUrl(storageKey));
            request.Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            var token = await GetContentTokenAsync();
            if (!string.IsNullOrWhiteSpace(token))
                request.Headers.Add("x-content-token", token);

            var response = await http.SendAsync(request);
            if (response.IsSuccessStatusCode) return;
        }
        catch { }

        await FallbackWriteAsync(data, storageKey);
    }

    private static string NetlifyContentUrl(string storageKey) =>
        $"/.netlify/functions/content?name={storageKey.Replace("jv_", "")}";

    private async Task<string?> GetContentTokenAsync()
    {
        if (js is null) return null;
        try
        {
            return await js.InvokeAsync<string?>("window.localStorage.getItem", "jv_content_token");
        }
        catch { return null; }
    }

    private async Task<T?> FallbackReadAsync<T>(string key) where T : class
    {
        if (js is null) return default;
        try
        {
            var json = await js.InvokeAsync<string?>("window.localStorage.getItem", key);
            return string.IsNullOrWhiteSpace(json) ? default : JsonSerializer.Deserialize<T>(json);
        }
        catch { return default; }
    }

    private async Task FallbackWriteAsync<T>(T data, string key)
    {
        if (js is null) return;
        try
        {
            var json = JsonSerializer.Serialize(data);
            await js.InvokeVoidAsync("window.localStorage.setItem", key, json);
        }
        catch { }
    }
}
