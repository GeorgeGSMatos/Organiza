using System.IO;
using System.Text.Json.Nodes;

namespace Organiza.Wpf.Presentation;

public sealed class HistoryRecord(JsonNode source)
{
    public JsonNode Source { get; } = source;
    public string Id => Source.S("id");
    public string FilePath => Source.S("source");
    public string Name => Path.GetFileName(FilePath);
    public string Destination => Source.S("destination");
    public string FolderId => Source.S("folderId");
    public string FolderName => Source.S("folderName", "Pasta não cadastrada");
    public string Status => Source.S("effectiveStatus", Source.S("status"));
    public bool IsTrashOperation => Source.S("operation") == "trash";
    public bool IsRecycled => IsTrashOperation && Status == "trashed";
    public bool CanUndo => !IsTrashOperation && Status == "moved";
    public bool NeedsAttention => Status is "failed" or "prepared" or "attention";
    public string Message => Source.S("lastUndoError", Source.S("message"));
    public DateTimeOffset? Time => DateTimeOffset.TryParse(Source.S("completedAt", Source.S("time")), out var value) ? value.ToLocalTime() : null;
    public string SearchText => string.Join(" ", Name, FilePath, Destination, FolderName, Source.S("ruleName"), FilePresentation.StatusLabel(Status), Message);
    public string FolderLabel
    {
        get
        {
            if (IsRecycled || Destination.Length == 0)
                return FolderName;
            return FolderName + " → " + Path.GetFileName(Path.GetDirectoryName(Destination));
        }
    }
}
