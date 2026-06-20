namespace johnvicencio.Controllers;

public sealed class RouterController
{
    public string HomePath => "/";

    public string BlogPath => "/blog";

    public string BlogPostPath(string slug) => $"/blog/{slug}";
}
