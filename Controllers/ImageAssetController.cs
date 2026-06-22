using System.Net.Http.Json;
using johnvicencio.Models;

namespace johnvicencio.Controllers;

public sealed class ImageAssetController
{
    private readonly HttpClient http;

    public ImageAssetController(HttpClient http)
    {
        this.http = http;
    }

    public async Task<List<ImageAsset>> GetImagesAsync()
    {
        try
        {
            return await http.GetFromJsonAsync<List<ImageAsset>>(".netlify/functions/image-index") ?? [];
        }
        catch
        {
            return await http.GetFromJsonAsync<List<ImageAsset>>("images/index.json") ?? [];
        }
    }
}
