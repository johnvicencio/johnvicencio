using Microsoft.JSInterop;

namespace johnvicencio.Controllers;

public static class LucideInterop
{
    public static ValueTask RefreshIconsAsync(IJSRuntime js)
    {
        try
        {
            return js.InvokeVoidAsync("refreshLucideIcons");
        }
        catch
        {
            return ValueTask.CompletedTask;
        }
    }
}
