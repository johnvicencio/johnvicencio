using Microsoft.AspNetCore.Components;

namespace johnvicencio.Controllers;

public sealed class AppEnvironment
{
    private readonly NavigationManager nav;

    public AppEnvironment(NavigationManager nav)
    {
        this.nav = nav;
    }

    public bool IsLocalhost => IsLocalhostUri(nav.BaseUri);

    public static bool IsLocalhostUri(string uri)
    {
        var host = new Uri(uri).Host;
        return host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || host == "127.0.0.1"
            || host == "::1";
    }
}
