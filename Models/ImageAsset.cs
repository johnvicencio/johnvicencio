namespace johnvicencio.Models;

public sealed class ImageAsset
{
    public string FileName { get; set; } = "";

    public string Url { get; set; } = "";

    public string Folder { get; set; } = "";

    public string ContentType { get; set; } = "";

    public long Size { get; set; }

    public DateTimeOffset UploadedUtc { get; set; }
}
