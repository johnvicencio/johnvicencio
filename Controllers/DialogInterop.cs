using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace johnvicencio.Controllers;

public static class DialogInterop
{
    public static ValueTask OpenAsync(IJSRuntime js, ElementReference dialog)
    {
        try
        {
            return js.InvokeVoidAsync("openAppDialog", dialog);
        }
        catch
        {
            return ValueTask.CompletedTask;
        }
    }

    public static ValueTask CloseAsync(IJSRuntime js, ElementReference dialog)
    {
        try
        {
            return js.InvokeVoidAsync("closeAppDialog", dialog);
        }
        catch
        {
            return ValueTask.CompletedTask;
        }
    }
}
