using System.Text.Json.Nodes;
using Organiza.Wpf.Presentation;

internal static class RedesignChecks
{
    public static void Run(Action<bool, string> check)
    {
        var today = new DateTime(2026, 10, 27);
        HistoryRecord Record(string id, string status, string operation, string time, string folder = "downloads", string name = "Relatório.pdf") => new(new JsonObject
        {
            ["id"] = id,
            ["effectiveStatus"] = status,
            ["operation"] = operation,
            ["time"] = time,
            ["folderId"] = folder,
            ["folderName"] = folder == "downloads" ? "Downloads" : "Pasta removida",
            ["source"] = @"C:\Downloads\" + name,
            ["destination"] = operation == "trash" ? null : @"C:\Downloads\Documentos\" + name,
            ["message"] = status == "failed" ? "Arquivo em uso. Tente novamente." : ""
        });
        var moved = Record("moved", "moved", "move", "2026-10-27T14:00:00-03:00");
        var trash = Record("trash", "trashed", "trash", "2026-10-27T13:00:00-03:00");
        var failedTrash = Record("failed", "failed", "trash", "2026-10-27T12:00:00-03:00");
        var old = Record("old", "undone", "move", "2026-09-01T12:00:00-03:00", "removed");
        var interrupted = Record("unknown-time", "attention", "move", "invalid-time", "removed");
        var records = new[] { moved, trash, failedTrash, old, interrupted };
        var filters = new HistoryFilters();
        check(filters.Apply(records, today).Count() == 4, "History period hides older rows without discarding undated interrupted operations");
        filters.Status = "trash";
        check(filters.Apply(records, today).SequenceEqual(new[] { trash }), "Recycle history never presents a failed recycling request as an item in the bin");
        filters.Status = "attention";
        check(filters.Apply(records, today).Count() == 2, "Attention includes failures and interrupted operations");
        filters.Period = "all";
        filters.Status = "all";
        filters.FolderId = "removed";
        check(filters.Apply(records, today).Count() == 2, "History remains filterable after a folder registration is removed");
        filters.FolderId = "";
        filters.Query = "em uso";
        check(filters.Apply(records, today).SequenceEqual(new[] { failedTrash }), "History search includes the actionable reason for a failure");
        filters.Clear();
        check(filters.Apply(records, today).Count() == 5 && filters.Page == 0, "Clearing history filters restores every record");
        check(moved.CanUndo && !trash.CanUndo && !failedTrash.CanUndo && !old.CanUndo, "Undo is offered only for eligible successful moves");
        check(FilePresentation.Quantity(1, "pasta", "pastas") == "1 pasta" && FilePresentation.Quantity(2, "pasta", "pastas") == "2 pastas", "Overview counts use the actual quantity without fixed sample labels");
    }
}
