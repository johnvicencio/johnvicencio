using System.Net.Http.Json;

namespace johnvicencio.Controllers;

public sealed class JsonContentService
{
    private readonly HttpClient httpClient;

    public JsonContentService(HttpClient httpClient)
    {
        this.httpClient = httpClient;
    }

    public async Task<T?> ReadAsync<T>(string path)
    {
        return await httpClient.GetFromJsonAsync<T>(path);
    }
}
