using System.Net.Http.Json;
using System.Text.Json;

namespace johnvicencio.Controllers;

public sealed class LogService
{
    private const int MaxLogLength = 2000;

    private readonly HttpClient http;

    public LogService(HttpClient http)
    {
        this.http = http;
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
            var logs = await http.GetFromJsonAsync<List<LogEntry>>("/.netlify/functions/logs");
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
}

public sealed class LogEntry
{
    public string Timestamp { get; set; } = "";
    public string Level { get; set; } = "";
    public string Source { get; set; } = "";
    public string Message { get; set; } = "";
    public string? Context { get; set; }
}
