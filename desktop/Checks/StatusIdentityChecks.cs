using System.Text.Json.Nodes;
using Organiza.Wpf.Presentation;

internal static class StatusIdentityChecks
{
    public static void Run(Action<bool, string> check)
    {
        var ready = new PreviewItem(new JsonObject { ["status"] = "ready" });
        check(ready.Tone == StatusTone.Ready && ready.Status == "Pronto", "A ready file is neutral and is not presented as an already completed operation");
        check(FilePresentation.StatusBrush("ready") != FilePresentation.StatusBrush("moved"), "Ready and organized files have distinct visual meanings");
        ready.Failure = "O arquivo está em uso.";
        check(ready.Tone == StatusTone.Error && ready.Status == "Não concluído", "A failed transfer has an explicit error state rather than an ordinary review warning");
        check(FilePresentation.DescribeStatus("review").Tone == StatusTone.Attention && FilePresentation.DescribeStatus("conflict").Tone == StatusTone.Attention,
            "Review and conflict states share the attention convention");
        check(FilePresentation.DescribeStatus("moved").Tone == StatusTone.Success && FilePresentation.DescribeStatus("undone").Tone == StatusTone.Success,
            "Completed organization and restoration share the success convention");
        check(FilePresentation.StatusBrush("trashed") == FilePresentation.StatusBrush("failed"), "Deletion and failures share the red convention");
        var manual = StatusPresentation.FolderMode(false);
        var automatic = StatusPresentation.FolderMode(true);
        check(manual.Label == "Manual" && manual.Tone == StatusTone.Manual && automatic.Label == "Automática" && automatic.Tone == StatusTone.Automatic,
            "Folder modes have independent labels and colors without changing their saved behavior");
        check(manual.BrushKey != StatusPresentation.BrushFor(StatusTone.Neutral), "Manual mode remains distinct from disabled or ignored information");
    }
}
