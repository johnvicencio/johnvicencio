namespace johnvicencio.Controllers;

public sealed class RouterController
{
    public string HomePath => "/";

    public string BlogPath => "/blog";

    public string BlogPagePath(int pageNumber) => pageNumber <= 1 ? "/blog" : $"/blog?page={pageNumber}";

    public string BlogPostPath(string slug) => $"/blog/{slug}";
}
