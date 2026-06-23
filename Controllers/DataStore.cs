using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.JSInterop;

namespace johnvicencio.Controllers;

public sealed class DataStore
{
    private readonly HttpClient http;
    private readonly IJSRuntime? js;
    private readonly LogService log;

    public DataStore(HttpClient http, LogService log, IJSRuntime? js = null)
    {
        this.http = http;
        this.log = log;
        this.js = js;
    }

    public async Task<List<T>> LoadAsync<T>(string contentName) where T : class
    {
        try
        {
            var fromBlob = await http.GetFromJsonAsync<List<T>>(NetlifyContentUrl(contentName));
            if (fromBlob is not null) return fromBlob;
        }
        catch (Exception ex)
        {
            await log.WarnAsync("DataStore", $"LoadAsync failed for {contentName}", new { error = ex.Message });
            return [];
        }

        return [];
    }

    public async Task<T?> LoadSingleAsync<T>(string contentName) where T : class
    {
        try
        {
            var fromBlob = await http.GetFromJsonAsync<T>(NetlifyContentUrl(contentName));
            if (fromBlob is not null) return fromBlob;
        }
        catch (Exception ex)
        {
            await log.WarnAsync("DataStore", $"LoadSingleAsync failed for {contentName}", new { error = ex.Message });
            return null;
        }

        return null;
    }

    public async Task SaveAsync<T>(T data, string contentName)
    {
        var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
        using var request = new HttpRequestMessage(HttpMethod.Put, NetlifyContentUrl(contentName));
        request.Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        var token = await GetContentTokenAsync();
        if (!string.IsNullOrWhiteSpace(token))
            request.Headers.Add("x-content-token", token);

        try
        {
            var response = await http.SendAsync(request);
            if (response.IsSuccessStatusCode)
            {
                await log.InfoAsync("DataStore", $"Saved {contentName}");
                return;
            }

            var error = await response.Content.ReadAsStringAsync();
            await log.ErrorAsync("DataStore", $"Save failed for {contentName}", new { status = (int)response.StatusCode, error });
            throw new InvalidOperationException($"Could not save {contentName}: {(int)response.StatusCode} {response.ReasonPhrase}. {error}");
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            await log.ErrorAsync("DataStore", $"Save exception for {contentName}", new { error = ex.Message });
            throw;
        }
    }

    private static string NetlifyContentUrl(string contentName) =>
        $"/.netlify/functions/content?name={contentName}";

    private async Task<string?> GetContentTokenAsync()
    {
        if (js is null) return null;
        try
        {
            return await js.InvokeAsync<string?>("window.localStorage.getItem", "jv_content_token");
        }
        catch { return null; }
    }
}
