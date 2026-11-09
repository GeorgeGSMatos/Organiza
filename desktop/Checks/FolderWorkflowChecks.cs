using System.IO;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using Organiza.Wpf;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;
using Organiza.Wpf.Services;

internal static class FolderWorkflowChecks
{
    private static IEnumerable<T> Children<T>(DependencyObject parent) where T : DependencyObject
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
        {
            var child = VisualTreeHelper.GetChild(parent, index);
            if (child is T item) yield return item;
            foreach (var nested in Children<T>(child)) yield return nested;
        }
    }
    private static async Task Wait(Func<Task<bool>> condition)
    {
        for (var attempt = 0; attempt < 150; attempt++)
        {
            if (await condition()) return;
            await Task.Delay(100);
        }
        throw new TimeoutException("O fluxo de pastas não chegou ao estado esperado.");
    }
    private static CheckBox Toggle(MainWindow window) => Children<CheckBox>(window)
        .Single(control => AutomationProperties.GetName(control) == "Organização automática");
    private static bool Idle(MainWindow window) => ((FrameworkElement)window.FindName("PageContent")).IsEnabled;

    public static async Task Run(string applicationRoot, Action<bool, string> check)
    {
        var root = Path.Combine(Path.GetTempPath(), "organiza-folder-workflow-" + Guid.NewGuid().ToString("N"));
        var profile = Path.Combine(root, "profile");
        var folder = Path.Combine(root, "Downloads");
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, "nota.pdf"), "temporary test file");
        MainWindow? window = null;
        TaskCompletionSource? closed = null;
        try
        {
            var bridge = await EngineBridge.Start(applicationRoot, profile);
            using var client = new OrganizaClient(bridge);
            await client.SaveFolder(new FolderDraft(folder, "Downloads", false));
            var id = (await client.GetState()).Items("folders").Single().S("id");
            await client.AddPresetRules(id);
            window = new MainWindow { Left = -20000, Top = -20000, ShowActivated = false, ShowInTaskbar = false };
            closed = new(TaskCreationOptions.RunContinuationsAsynchronously);
            window.Closed += (_, _) => closed.TrySetResult();
            window.Show();
            await window.Connect(bridge);
            window.UpdateLayout();
            check(Toggle(window).IsChecked == false, "Overview exposes the saved manual mode as a switch");
            var toggle = Toggle(window);
            toggle.IsChecked = true;
            toggle.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent, toggle));
            await Wait(async () => Idle(window) && (await client.GetState())!["monitor"].Items("activeIds").Any());
            check(((TextBlock)window.FindName("PageTitle")).Text == "Visão geral", "Switch activation does not open the folder card");
            check((await client.GetState()).Items("folders").Single().S("organizationMode") == "automatic", "One switch action activates and saves automatic mode");
            Children<RadioButton>(window).First(control => Equals(control.Tag, AppPage.Folders)).IsChecked = true;
            await Wait(() => Task.FromResult(Idle(window) && Children<DataGrid>(window).Any(grid => grid.Items.OfType<PreviewItem>().Any(row => row.Name == "nota.pdf"))));
            check(true, "Opening Folders analyzes and lists files without clicking Analyze");
            Toggle(window).IsChecked = false;
            await Wait(async () => Idle(window) && (await client.GetState()).Items("folders").Single().S("organizationMode") == "manual");
            check(Children<DataGrid>(window).Single().Items.OfType<PreviewItem>().Any(), "Switching to manual keeps the analyzed files visible");
            var row = Children<DataGrid>(window).Single().Items.OfType<PreviewItem>().Single();
            row.Selected = true;
            Toggle(window).IsChecked = true;
            await Wait(async () => Idle(window) && (await client.GetState())!["monitor"].Items("activeIds").Any());
            check(Children<DataGrid>(window).Single().Items.OfType<PreviewItem>().Single().Selected, "Changing only the folder mode preserves the file selection");
            Children<RadioButton>(window).First(control => Equals(control.Tag, AppPage.Overview)).IsChecked = true;
            await Task.Delay(200);
            check(Toggle(window).IsChecked == true, "Overview and Folders share the same saved automatic mode");
            File.WriteAllText(Path.Combine(folder, "novo.txt"), "another temporary file");
            Children<RadioButton>(window).First(control => Equals(control.Tag, AppPage.Folders)).IsChecked = true;
            await Wait(() => Task.FromResult(Idle(window) && Children<DataGrid>(window).Any(grid => grid.Items.OfType<PreviewItem>().Any(item => item.Name == "novo.txt"))));
            check(true, "Reopening the folder refreshes files created since the last analysis");
            window.RequestExit();
            await closed.Task.WaitAsync(TimeSpan.FromSeconds(15));
            var reopened = await EngineBridge.Start(applicationRoot, profile);
            using var reopenedClient = new OrganizaClient(reopened);
            await reopenedClient.RestoreMonitoring();
            check((await reopenedClient.GetState())!["monitor"].Items("activeIds").Any(), "Saved automatic mode resumes in a new engine session");
            await reopenedClient.PauseMonitoring(id);
            await reopenedClient.Shutdown();
        }
        finally
        {
            if (window is not null && closed is not null && !closed.Task.IsCompleted)
            {
                window.RequestExit();
                await closed.Task.WaitAsync(TimeSpan.FromSeconds(15));
            }
            Directory.Delete(root, true);
        }
    }
}
