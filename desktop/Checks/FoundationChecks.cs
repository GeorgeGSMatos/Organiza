using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;
using Organiza.Wpf;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;
using Organiza.Wpf.Services;

internal static class FoundationChecks
{
    public static async Task Run(Action<bool, string> check)
    {
        var navigation = new AppNavigation();
        navigation.OpenFolder("downloads");
        navigation.ShowFolderRules();
        check(navigation.Page == AppPage.Rules && navigation.FolderId == "downloads" && navigation.CanReturnToFolder, "Navigation preserves the folder when opening its rules");
        navigation.SelectRulesFolder("drive");
        check(navigation.FolderId == "drive" && !navigation.CanReturnToFolder, "Choosing another rules folder clears the old return context");
        navigation.OpenFolder("downloads");
        navigation.ShowFolders();
        check(navigation.Page == AppPage.Folders && !navigation.IsFolderOpen && navigation.FolderId == "downloads", "Folder navigation distinguishes the list from the workspace");
        navigation.OpenFolder("deleted");
        navigation.ShowFolderRules();
        navigation.ReconcileFolders(["drive"]);
        check(navigation.FolderId == "drive" && !navigation.IsFolderOpen && !navigation.CanReturnToFolder, "Removing the selected folder clears stale navigation context");
        var rejected = false;
        try
        {
            navigation.Navigate((AppPage)999);
        }
        catch (ArgumentOutOfRangeException) { rejected = true; }
        check(rejected && AppPages.All.Select(p => p.Page).Distinct().Count() == AppPages.All.Count, "Navigation rejects unknown pages and has unique destinations");

        var discovering = ProgressDisplay.From(new EngineProgress(ProgressKind.Discovering));
        check(discovering.IsIndeterminate && discovering.Percent == 0 && !discovering.Message.Contains('%'), "Discovery never invents a percentage before knowing the total");
        var progress = ProgressDisplay.From(EngineProgress.Analysis(JsonNode.Parse("{\"phase\":\"analyzing\",\"total\":24,\"completed\":10}")));
        check(!progress.IsIndeterminate && Math.Abs(progress.Percent - 1000d / 24) < .001 && progress.Message.Contains("42%"), "Analysis derives its percentage from actual processed files");
        var partial = ProgressDisplay.From(EngineProgress.Analysis(JsonNode.Parse("{\"phase\":\"analyzing\",\"total\":24,\"completed\":24,\"partial\":true}")));
        check(partial.IsIndeterminate && !partial.Message.Contains("100%"), "Partial analysis is never presented as a completed full scan");
        check(EngineProgress.Operation(JsonNode.Parse("{\"busy\":false}")) is null, "An idle engine event does not fabricate operation success");

        var transport = new RecordingEngine();
        var client = new OrganizaClient(transport);
        await client.SaveFolder(new FolderDraft(@"C:\Downloads", "Downloads", true));
        var folder = transport.Calls.Last().Args[0]!;
        check(folder.S("path") == @"C:\Downloads" && folder.B("includeSubfolders") && folder["Path"] is null, "Folder DTO preserves the engine's camel-case wire contract");
        await client.UpdateSettings(new SettingsPatch { ConfirmRemoval = false });
        var patch = transport.Calls.Last().Args[0]!;
        check(patch.B("confirmRemoval", true) == false && patch.AsObject().Count == 1, "Settings patches preserve false and omit unspecified preferences");
        await client.ActivateMonitoring(["downloads", "drive"]);
        var args = transport.Calls.Last().Args;
        check(args.Count == 1 && args[0] is JsonArray ids && ids.Count == 2, "Monitoring sends one array argument instead of flattening the selected folders");
        transport.Calls.Clear();
        await client.Cancel();
        check(transport.Calls.Select(c => c.Method).SequenceEqual(new[] { "organize:cancel", "preview:cancel", "monitor:suspend" }), "Cancellation suspends operations and monitoring without changing saved folder modes");
        var notifications = 0;
        client.AnalysisProgress += _ => notifications++;
        transport.Emit("preview:progress", JsonNode.Parse("{\"phase\":\"discovering\"}"));
        client.Dispose();
        transport.Emit("preview:progress", null);
        check(notifications == 1 && transport.SubscriberCount == 0, "Disposing the UI client detaches engine event subscriptions");

        var search = Ui.Search("", "Buscar no histórico");
        var components = new StackPanel();
        components.Children.Add(search);
        var host = new Window { Content = components, Width = 400, Height = 200, Left = -20000, Top = -20000, ShowActivated = false, ShowInTaskbar = false, WindowStartupLocation = WindowStartupLocation.Manual };
        host.Show();
        await Task.Delay(50);
        search.ApplyTemplate();
        check(AutomationProperties.GetName(search) == "Buscar no histórico" && search.Tag?.ToString() == "Buscar" && ((SolidColorBrush)search.Background).Color.A < 255, "Shared search keeps a short placeholder, accessible context and a translucent surface");
        var app = Application.Current;
        var width = app.Resources["SearchWidth"];
        var effectiveWidth = search.Width;
        app.Resources["SearchWidth"] = effectiveWidth + 20;
        await Task.Delay(30);
        check(search.Width == effectiveWidth + 20, "Changing a search token updates an existing control without rebuilding its page");
        if (width is null)
            app.Resources.Remove("SearchWidth");
        else
            app.Resources["SearchWidth"] = width;
        var text = Ui.Text("Legenda", TextRole.Caption);
        components.Children.Add(text);
        var previousCaption = app.Resources["FontCaption"];
        var captionSize = text.FontSize;
        app.Resources["FontCaption"] = captionSize + 1;
        await Task.Delay(30);
        check(text.FontSize == captionSize + 1, "Typography tokens update existing text controls");
        if (previousCaption is null)
            app.Resources.Remove("FontCaption");
        else
            app.Resources["FontCaption"] = previousCaption;
        var trash = Ui.Icon(AppIcon.Trash, "Enviar à Lixeira", () => { });
        check(trash.ToolTip?.ToString() == "Enviar à Lixeira" && Equals(trash.Foreground, app.FindResource("ShadeDangerBrush")), "Trash icons inherit the shared danger color and an accessible action label");
        host.Close();
    }

    private sealed class RecordingEngine : IEngine
    {
        public event Action<string, JsonNode?>? Changed;
        public int SubscriberCount => Changed?.GetInvocationList().Length ?? 0;
        public List<(string Method, JsonArray Args)> Calls { get; } = [];
        public Task<JsonNode?> Call(string method, params object?[] args)
        {
            Calls.Add((method, JsonSerializer.SerializeToNode(args)!.AsArray()));
            return Task.FromResult<JsonNode?>(null);
        }
        public void Emit(string name, JsonNode? value) => Changed?.Invoke(name, value);
        public Task Shutdown() => Task.CompletedTask;
    }
}
