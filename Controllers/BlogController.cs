using johnvicencio.Models;

namespace johnvicencio.Controllers;

public sealed class BlogController
{
    private const string StorageKey = "jv_posts";
    private const string JsonUrl = "data/posts.json";

    private readonly DataStore store;
    private List<BlogPost>? posts;

    public BlogController(DataStore store)
    {
        this.store = store;
    }

    public async Task<List<BlogPost>> GetPostsAsync()
    {
        posts ??= await store.LoadAsync<BlogPost>(JsonUrl, StorageKey);
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
        all.Add(post);
        await store.SaveAsync(all, StorageKey);
    }

    public async Task UpdatePostAsync(BlogPost post)
    {
        var all = await GetPostsAsync();
        var index = all.FindIndex(p => p.Id == post.Id);
        if (index >= 0)
            all[index] = post;
        await store.SaveAsync(all, StorageKey);
    }

    public async Task DeletePostAsync(string postId)
    {
        var all = await GetPostsAsync();
        all.RemoveAll(p => p.Id == postId);
        await store.SaveAsync(all, StorageKey);
    }
}
