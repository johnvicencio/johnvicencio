using System.Net.Http.Json;
using johnvicencio.Models;
using Microsoft.JSInterop;

namespace johnvicencio.Controllers;

public sealed class ContactMessageController
{
    private readonly HttpClient http;
    private readonly IJSRuntime js;

    public ContactMessageController(HttpClient http, IJSRuntime js)
    {
        this.http = http;
        this.js = js;
    }

    public async Task<List<ContactMessage>> GetMessagesAsync()
    {
        var response = await SendAdminRequestAsync(HttpMethod.Get, "/.netlify/functions/contact");
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return [];

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Could not load messages: {(int)response.StatusCode} {response.ReasonPhrase}. {error}");
        }

        return await response.Content.ReadFromJsonAsync<List<ContactMessage>>() ?? [];
    }

    public async Task<ContactMessage?> GetMessageAsync(string id)
    {
        var messages = await GetMessagesAsync();
        return messages.FirstOrDefault(message => message.Id == id);
    }

    public async Task MarkReadAsync(string id)
    {
        var response = await SendAdminRequestAsync(HttpMethod.Patch, $"/.netlify/functions/contact?id={Uri.EscapeDataString(id)}");
        if (response.IsSuccessStatusCode) return;

        var error = await response.Content.ReadAsStringAsync();
        throw new InvalidOperationException($"Could not mark message read: {(int)response.StatusCode} {response.ReasonPhrase}. {error}");
    }

    public async Task DeleteMessageAsync(string id)
    {
        var response = await SendAdminRequestAsync(HttpMethod.Delete, $"/.netlify/functions/contact?id={Uri.EscapeDataString(id)}");
        if (response.IsSuccessStatusCode) return;

        var error = await response.Content.ReadAsStringAsync();
        throw new InvalidOperationException($"Could not delete message: {(int)response.StatusCode} {response.ReasonPhrase}. {error}");
    }

    private async Task<HttpResponseMessage> SendAdminRequestAsync(HttpMethod method, string url)
    {
        using var request = new HttpRequestMessage(method, url);
        var token = await GetContentTokenAsync();
        if (!string.IsNullOrWhiteSpace(token))
        {
            request.Headers.Add("x-content-token", token);
        }

        return await http.SendAsync(request);
    }

    private async Task<string?> GetContentTokenAsync()
    {
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
