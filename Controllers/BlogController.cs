using johnvicencio.Models;

namespace johnvicencio.Controllers;

public sealed class BlogController
{
    private const string ContentName = "posts";

    private readonly DataStore store;
    private List<BlogPost>? posts;

    public BlogController(DataStore store)
    {
        this.store = store;
    }

    public async Task<List<BlogPost>> GetPostsAsync()
    {
        posts ??= await store.LoadAsync<BlogPost>(ContentName);
        return posts;
    }

    public async Task<BlogPost?> GetPostAsync(string slug)
    {
        var all = await GetPostsAsync();
        return all.FirstOrDefault(p => p.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
    }

    public async Task AddPostAsync(BlogPost post)
    {
        var all = await GetPostsAsync();
        if (all.Any(p => p.Slug.Equals(post.Slug, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"A post with slug '{post.Slug}' already exists.");

        var updated = new List<BlogPost>(all) { post };
        await store.SaveAsync(updated, ContentName);
        posts = updated;
    }

    public async Task UpdatePostAsync(BlogPost post)
    {
        var all = await GetPostsAsync();
        if (all.Any(p => p.Id != post.Id && p.Slug.Equals(post.Slug, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"A post with slug '{post.Slug}' already exists.");

        var updated = new List<BlogPost>(all);
        var index = updated.FindIndex(p => p.Id == post.Id);
        if (index >= 0)
            updated[index] = post;
        await store.SaveAsync(updated, ContentName);
        posts = updated;
    }

    public async Task DeletePostAsync(string postId)
    {
        var all = await GetPostsAsync();
        var updated = new List<BlogPost>(all);
        updated.RemoveAll(p => p.Id == postId);
        await store.SaveAsync(updated, ContentName);
        posts = updated;
    }
}
