using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.JSInterop;

namespace johnvicencio.Controllers;

public sealed class LogService
{
    private const int MaxLogLength = 2000;

    private readonly HttpClient http;
    private readonly IJSRuntime? js;

    public LogService(HttpClient http, IJSRuntime? js = null)
    {
        this.http = http;
        this.js = js;
    }

    public async Task LogAsync(string level, string source, string message, object? context = null)
    {
        try
        {
            var entry = new
            {
                level,
                source,
                message = Truncate(message, MaxLogLength),
                context = SerializeContext(context),
            };

            using var request = new HttpRequestMessage(HttpMethod.Put, "/.netlify/functions/logs?action=write");
            request.Content = new StringContent(
                JsonSerializer.Serialize(entry),
                System.Text.Encoding.UTF8,
                "application/json"
            );

            var token = await GetContentTokenAsync();
            if (!string.IsNullOrWhiteSpace(token))
                request.Headers.Add("x-content-token", token);

            using var response = await http.SendAsync(request);
        }
        catch
        {
        }
    }

    public async Task InfoAsync(string source, string message, object? context = null)
        => await LogAsync("info", source, message, context);

    public async Task WarnAsync(string source, string message, object? context = null)
        => await LogAsync("warn", source, message, context);

    public async Task ErrorAsync(string source, string message, object? context = null)
        => await LogAsync("error", source, message, context);

    public async Task<List<LogEntry>> GetLogsAsync()
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/.netlify/functions/logs");
            var token = await GetContentTokenAsync();
            if (!string.IsNullOrWhiteSpace(token))
                request.Headers.Add("x-content-token", token);

            using var response = await http.SendAsync(request);
            if (!response.IsSuccessStatusCode) return [];

            var logs = await response.Content.ReadFromJsonAsync<List<LogEntry>>();
            return logs ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static string Truncate(string value, int maxLength) =>
        value?.Length > maxLength ? value[..maxLength] + "..." : value ?? "";

    private static string? SerializeContext(object? context)
    {
        if (context is null) return null;
        try
        {
            var json = JsonSerializer.Serialize(context,
                new JsonSerializerOptions { WriteIndented = false, MaxDepth = 3 });
            return Truncate(json, 1000);
        }
        catch
        {
            return context.ToString();
        }
    }

    private async Task<string?> GetContentTokenAsync()
    {
        if (js is null) return null;
        try
        {
            return await js.InvokeAsync<string?>("window.localStorage.getItem", "jv_content_token");
        }
        catch
        {
            return null;
        }
    }
}

public sealed class LogEntry
{
    public string Timestamp { get; set; } = "";
    public string Level { get; set; } = "";
    public string Source { get; set; } = "";
    public string Message { get; set; } = "";
    public string? Context { get; set; }
}
