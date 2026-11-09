using System.IO;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using System.Windows.Interop;
using Organiza.Wpf;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;
using Organiza.Wpf.Services;

internal sealed class CheckApp : App
{
    protected override void OnStartup(StartupEventArgs e)
    {
    }
}
internal static class Program
{
    private static int _count;
    [STAThread]
    public static int Main(string[] args)
    {
        Console.OutputEncoding = new System.Text.UTF8Encoding(false);
        var app = new CheckApp();
        app.InitializeComponent();
        app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        new ThemeService().Apply(app, true);
        var result = 1;
        app.Dispatcher.BeginInvoke(new Action(async () =>
        {
            try
            {
                if (args.Length == 1 && args[0] == "--status-identity")
                    StatusIdentityChecks.Run(Check);
                else if (args.Length == 2 && args[0] == "--folder-workflow")
                    await FolderWorkflowChecks.Run(args[1], Check);
                else if (args.Length == 1 && args[0] == "--startup")
                    StartupCommandChecks.Run(Check);
                else if (args.Length == 2 && args[0] == "--tray")
                    await TrayLifecycleChecks.Run(args[1], Check);
                else
                    await Run(args[0], args[1]);
                result = 0;
            }
            catch (Exception error) { Console.Error.WriteLine(error); }
            finally { app.Shutdown(); }
        }));
        app.Run();
        return result;
    }
    private static void Check(bool value, string name)
    {
        if (!value)
            throw new InvalidOperationException("FAILED: " + name);
        _count++;
        Console.WriteLine("PASS: " + name);
    }
    private static async Task Wait(Func<bool> condition)
    {
        for (var n = 0; n < 200; n++)
        {
            if (condition())
                return;
            await Task.Delay(50);
        }
        throw new TimeoutException("A interface não chegou ao estado esperado.");
    }
    private static IEnumerable<T> Children<T>(DependencyObject parent) where T : DependencyObject
    {
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is T match)
                yield return match;
            foreach (var nested in Children<T>(child))
                yield return nested;
        }
    }
    private static Button Find(MainWindow window, string label) => Children<Button>(window).First(b => b.Content?.ToString() == label || System.Windows.Automation.AutomationProperties.GetName(b) == label);
    private static void Click(Button button) => button.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
    private static async Task DriveDialog(MainWindow window, string buttonLabel, Action<UiDialog> fill, string? capture = null)
    {
        var done = new TaskCompletionSource();
        _ = window.Dispatcher.BeginInvoke(new Action(async () =>
        {
            try
            {
                var dialog = Application.Current.Windows.OfType<UiDialog>().First(w => w.IsVisible);
                fill(dialog);
                if (capture is not null)
                    await Save(dialog, capture);
                Click(dialog.Save);
                try
                {
                    await Wait(() => !dialog.IsVisible);
                }
                catch { throw new InvalidOperationException("Editor: " + dialog.Error.Text); }
                done.SetResult();
            }
            catch (Exception error) { foreach (var dialog in Application.Current.Windows.OfType<UiDialog>().ToArray()) dialog.Close(); done.SetException(error); }
        }), DispatcherPriority.Background);
        Click(Find(window, buttonLabel));
        await done.Task;
        await Wait(() => ((StackPanel)window.FindName("Navigation")).IsEnabled);
        await Task.Delay(100);
    }
    private static async Task Run(string applicationRoot, string output)
    {
        await FoundationChecks.Run(Check);
        await InterfaceIdentityChecks.Run(Check);
        RedesignChecks.Run(Check);
        Directory.CreateDirectory(output);
        var root = Path.Combine(Path.GetTempPath(), "Organiza-Wpf-Checks-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var folder = Path.Combine(root, "Downloads");
        Directory.CreateDirectory(folder);
        var source = Path.Combine(folder, "nota.pdf");
        await File.WriteAllTextAsync(source, "CONTEÚDO PRESERVADO");
        File.SetLastWriteTimeUtc(source, DateTime.UtcNow.AddMinutes(-10));
        var unknown = Path.Combine(folder, "arte.psd");
        await File.WriteAllTextAsync(unknown, "DESIGN");
        File.SetLastWriteTimeUtc(unknown, DateTime.UtcNow.AddMinutes(-10));
        var bridge = await EngineBridge.Start(applicationRoot, Path.Combine(root, "profile"));
        var state = await bridge.Call("state:get");
        Check(state!.N("version") == 3 && !state.Items("folders").Any(), "WPF engine opens an isolated v3 profile");
        using var client = new OrganizaClient(bridge);
        state = await client.SaveFolder(new FolderDraft(folder, "Downloads", false));
        var id = state!.Items("folders").First().S("id");
        await bridge.Call("rule:presets", id);
        var drive = Path.Combine(root, "My Drive");
        var documents = Path.Combine(root, "Documentos");
        Directory.CreateDirectory(drive);
        Directory.CreateDirectory(documents);
        await client.SaveFolder(new FolderDraft(drive, "My Drive", false));
        await client.SaveFolder(new FolderDraft(documents, "Documentos", false));
        var window = new MainWindow { Left = -20000, Top = -20000, ShowActivated = false, ShowInTaskbar = false, WindowStartupLocation = WindowStartupLocation.Manual };
        window.Show();
        await window.Connect(bridge);
        await Task.Delay(250);
        Check(Children<TextBlock>(window).Any(t => t.Text == "Downloads"), "Native overview renders saved folders");
        Check(Children<TextBlock>(window).Any(t => t.Text == "3 pastas"), "Overview derives its summary from the three registered test folders");
        Check(window.FontFamily.Source.Contains("Segoe"), "Native Segoe typography matches ShadeFlow");
        Check(UiMotion.GetScope(window), "Native window enables accessible UI transitions");
        foreach (var (tag, title) in new[] { (AppPage.Overview, "Visão geral"), (AppPage.Folders, "Pastas"), (AppPage.Rules, "Regras"), (AppPage.History, "Histórico"), (AppPage.Settings, "Configurações") })
        {
            Children<RadioButton>(window).First(r => Equals(r.Tag, tag)).IsChecked = true;
            await Task.Delay(350);
            window.UpdateLayout();
            Check(((TextBlock)window.FindName("PageTitle")).Text == title, "Navigation opens " + title);
            if (tag == AppPage.Rules)
            {
                var picker = Children<ComboBox>(window).First();
                Check(((SolidColorBrush)picker.Background).Color.A < 255, "Closed dropdown uses a translucent surface");
                picker.IsDropDownOpen = true;
                await Task.Delay(150);
                picker.ApplyTemplate();
                var popup = (System.Windows.Controls.Primitives.Popup)picker.Template.FindName("PART_Popup", picker);
                Check(popup.IsOpen && popup.Child is Border, "Shared dropdown opens with a custom floating surface");
                Check(popup.AllowsTransparency, "Folder dropdown supports per-pixel transparency independently of native acrylic");
                picker.IsDropDownOpen = false;
                var cards = Children<WrapPanel>(window).First(p => p.Children.OfType<Border>().Count() >= 2);
                var first = (Border)cards.Children[0];
                var second = (Border)cards.Children[1];
                Check(Math.Abs(first.TranslatePoint(new Point(), window).Y - second.TranslatePoint(new Point(), window).Y) < 2, "Rules use two columns at the regular window width");
                window.Width = 1000;
                await Task.Delay(150);
                window.UpdateLayout();
                Check(second.TranslatePoint(new Point(), window).Y > first.TranslatePoint(new Point(), window).Y + 20, "Rules adapt to one column at the minimum window width");
                window.Width = 1280;
                await Task.Delay(150);
            }
            if (tag == AppPage.Settings)
                Check(!Children<TextBlock>(window).Any(t => t.Text.Contains("WPF") || t.Text.Contains("Tema escuro") || t.Text == "Aparência" || t.Text.Contains("Visualização compacta")), "Settings omit compact view, redundant theme and implementation details");
            await Save(window, Path.Combine(output, tag.ToString().ToLowerInvariant() + ".png"));
        }
        Children<RadioButton>(window).First(r => Equals(r.Tag, AppPage.Rules)).IsChecked = true;
        await Task.Delay(200);
        Check(Children<TextBlock>(window).Any(t => t.Text == "Documentos"), "All preset categories are available in WPF");
        var ruleSearch = Children<Organiza.Wpf.Presentation.Controls.SearchField>(window).Single();
        ruleSearch.Text = "Documentos";
        await Task.Delay(100);
        Check(Children<Organiza.Wpf.Presentation.Controls.ResponsiveCardPanel>(window).Single().Children.Count == 1, "Rule search filters the actual cards without resetting the selected folder");
        ruleSearch.Text = "";
        await Task.Delay(100);
        // Drive a real modal editor through its nested Dispatcher without production settings.
        var dialogDone = new TaskCompletionSource();
        _ = window.Dispatcher.BeginInvoke(new Action(async () =>
        {
            try
            {
                var dialog = Application.Current.Windows.OfType<UiDialog>().First(w => w.IsVisible);
                var inputs = Children<TextBox>(dialog).ToList();
                inputs.First(t => System.Windows.Automation.AutomationProperties.GetName(t) == "Nome da regra").Text = "Textos pessoais";
                inputs.First(t => System.Windows.Automation.AutomationProperties.GetName(t) == "Valor da condição").Text = "txt";
                inputs.First(t => System.Windows.Automation.AutomationProperties.GetName(t) == "Caminho de destino").Text = "Textos";
                Check(inputs.All(input => Math.Abs(input.ActualHeight - 32) < 1), "Actual rule editor uses compact inputs consistently");
                Check(dialog.Save.Content?.ToString() == "Salvar", "Rule editor presents the concise shared save action");
                await Save(dialog, Path.Combine(output, "new-rule.png"));
                Click(dialog.Save);
                try
                {
                    await Wait(() => !dialog.IsVisible);
                }
                catch { throw new InvalidOperationException("Editor: " + dialog.Error.Text); }
                dialogDone.SetResult();
            }
            catch (Exception error) { foreach (var dialog in Application.Current.Windows.OfType<UiDialog>().ToArray()) dialog.Close(); dialogDone.SetException(error); }
        }), DispatcherPriority.Background);
        Click(Find(window, "Nova regra"));
        await dialogDone.Task;
        await Task.Delay(250);
        state = await bridge.Call("state:get");
        Check(state!.Items("folders").First()["organization"].Items("rules").Any(r => r.S("name") == "Textos pessoais"), "Native category editor saves through the validated engine");
        await DriveDialog(window, "Exceções e revisão", dialog =>
        {
            var inputs = Children<TextBox>(dialog).ToList();
            Check(inputs.Where(input => input.AcceptsReturn).All(input => Math.Abs(input.ActualHeight - 96) < 1), "Policy lists have uniform multiline height");
            Check(inputs.Where(input => !input.AcceptsReturn).All(input => Math.Abs(input.ActualHeight - 32) < 1), "Policy numeric fields keep the compact input height");
        }, Path.Combine(output, "policy.png"));
        await DriveDialog(window, "Ajuda", dialog =>
        {
            Check(dialog.Title == "Ajuda · Regras" && dialog.Save.Content?.ToString() == "Entendi", "Help opens the contextual dialog with a single clear closing action");
            Check(Children<Button>(dialog).Count(button => button.IsVisible && button.IsDefault) == 1 && !Children<Button>(dialog).Any(button => button.IsVisible && button.Content?.ToString() == "Cancelar"), "Informational help avoids a redundant cancel button");
        }, Path.Combine(output, "help.png"));
        state = await bridge.Call("state:get");
        Check(state!.Items("folders").First()["organization"].N("minAgeSeconds") == 90, "Native policy editor preserves numeric and exclusion settings");
        Children<RadioButton>(window).First(r => Equals(r.Tag, AppPage.Overview)).IsChecked = true;
        await Task.Delay(200);
        Check(!Children<DataGrid>(window).Any() && !Children<ComboBox>(window).Any(), "Overview has no generic preview or all-folders dropdown");
        var options = Find(window, "Opções da pasta");
        Click(options);
        await Task.Delay(150);
        var floating = PresentationSource.CurrentSources.OfType<HwndSource>().Where(s => s.RootVisual is not null).SelectMany(s => Children<Border>(s.RootVisual)).FirstOrDefault(border => UiMotion.GetScope(border) && Children<Button>(border).Count() == 3);
        Check(floating is not null && Children<Button>(floating).Select(button => System.Windows.Automation.AutomationProperties.GetName(button)).SequenceEqual(new[] { "Editar pasta", "Abrir no Explorador", "Remover do Organiza" }), "Folder menu renders all three actions in its own animation scope");
        Check(((TextBlock)window.FindName("PageTitle")).Text == "Visão geral", "Opening folder options does not trigger the card navigation");
        Click(options);
        await Task.Delay(100);
        Click(Find(window, "Downloads"));
        await Task.Delay(150);
        Check(((TextBlock)window.FindName("PageTitle")).Text == "Pastas" && Children<ComboBox>(window).Any(picker => System.Windows.Automation.AutomationProperties.GetName(picker) == "Pasta atual"), "Clicking the folder opens its workspace");
        var folderPicker = Children<ComboBox>(window).Single(box => System.Windows.Automation.AutomationProperties.GetName(box) == "Pasta atual");
        var driveId = (await client.GetState())!.Items("folders").First(item => item.S("name") == "My Drive").S("id");
        folderPicker.SelectedValue = driveId;
        await Task.Delay(100);
        Check(Children<ComboBox>(window).Single(box => System.Windows.Automation.AutomationProperties.GetName(box) == "Pasta atual").SelectedValue?.ToString() == driveId, "Folder selector opens the chosen workspace without requiring the overview");
        Children<ComboBox>(window).Single(box => System.Windows.Automation.AutomationProperties.GetName(box) == "Pasta atual").SelectedValue = id;
        Click(Find(window, "Analisar"));
        await Wait(() => Children<DataGrid>(window).Any() && ((StackPanel)window.FindName("Navigation")).IsEnabled);
        Check(Children<DataGrid>(window).First().Items.Count == 2, "Native preview shows classified and unmatched files");
        var grid = Children<DataGrid>(window).First();
        grid.Items.OfType<PreviewItem>().First(r => r.Name == "arte.psd").Selected = true;
        Click(Find(window, "Prontos · 1"));
        await Task.Delay(100);
        Check(Children<TextBlock>(window).Any(t => t.Text.Contains("1 fora do filtro")), "Selection outside the current filter remains explicit");
        grid = Children<DataGrid>(window).First();
        ((CheckBox)grid.Columns[0].Header).IsChecked = true;
        Check(Children<TextBlock>(window).Any(t => t.Text.Contains("2 selecionados")), "Select-all affects the current filter without losing other selected files");
        Click(Find(window, "Limpar seleção"));
        Click(Find(window, "Todos · 2"));
        await Task.Delay(100);
        grid = Children<DataGrid>(window).First();
        grid.SelectedItem = grid.Items.OfType<PreviewItem>().First(r => r.Name == "arte.psd");
        await Task.Delay(100);
        Check(Children<TextBlock>(window).Any(t => t.Text == "Sugestão"), "Suggestions appear in the selected file context");
        await Save(window, Path.Combine(output, "preview.png"));
        await DriveDialog(window, "Criar categoria", _ => { });
        state = await bridge.Call("state:get");
        Check(state!.Items("folders").First()["organization"].Items("rules").Any(r => r.S("name") == "Design" && !r.B("enabled")), "Native suggestions prepare a one-off category without enabling future moves");
        Check(File.Exists(unknown), "Preparing a native suggestion never moves the file");
        grid = Children<DataGrid>(window).First();
        foreach (var item in grid.Items.OfType<PreviewItem>())
            item.Selected = true;
        grid.SelectedItem = grid.Items.OfType<PreviewItem>().First(item => item.Name == "nota.pdf");
        grid.UpdateLayout();
        await Task.Delay(50);
        var selectedRow = (DataGridRow)grid.ItemContainerGenerator.ContainerFromItem(grid.Items[0]);
        Check(Equals(selectedRow.Background, Application.Current.FindResource("ShadeSelectionBrush")), "Selected files receive the shared blue row highlight as well as checked boxes");
        await Save(window, Path.Combine(output, "preview-selected.png"));
        window.Width = 1000;
        window.Height = 700;
        await Task.Delay(250);
        window.UpdateLayout();
        Check(((FrameworkElement)window.FindName("PageContent")).ActualWidth > 600, "Minimum window preserves usable preview width");
        await Save(window, Path.Combine(output, "compact.png"));
        // Exercise the actual UI confirmation, operation and refresh, not only engine commands.
        grid = Children<DataGrid>(window).First();
        foreach (var item in grid.Items.OfType<PreviewItem>())
            item.Selected = item.Name == "nota.pdf";
        await DriveDialog(window, "Organizar", _ => { });
        Check(((TextBlock)window.FindName("PageTitle")).Text == "Pastas" && Children<ComboBox>(window).Any(picker => System.Windows.Automation.AutomationProperties.GetName(picker) == "Pasta atual"), "Organizing stays in the folder workspace");
        Check(Children<DataGrid>(window).First().Items.OfType<PreviewItem>().All(r => r.Name != "nota.pdf"), "Completed files disappear from a freshly scanned list");
        Children<RadioButton>(window).First(button => Equals(button.Tag, AppPage.History)).IsChecked = true;
        await Wait(() => Children<Button>(window).Any(button => System.Windows.Automation.AutomationProperties.GetName(button) == "Desfazer movimentação"));
        await DriveDialog(window, "Desfazer movimentação", _ => { });
        Check(File.Exists(source) && await File.ReadAllTextAsync(source) == "CONTEÚDO PRESERVADO", "History undo icon restores the temporary file through its real confirmation");
        Children<RadioButton>(window).First(button => Equals(button.Tag, AppPage.Folders)).IsChecked = true;
        var preview = await bridge.Call("preview:scan", id);
        var row = preview!.Items("rows").First(r => r.S("name") == "nota.pdf");
        Check(row.S("status") == "ready", "Windows metadata produces a ready PDF");
        var plan = await bridge.Call("organize:plan", preview.S("id"), new[] { row.S("id") });
        var result = await bridge.Call("organize:execute", plan!.S("id"), false);
        Check(result!.N("moved") == 1, "Native Windows transfer organizes the confirmed test file");
        var history = await bridge.Call("history:list");
        var entry = history!.Items("entries").First();
        Check(await File.ReadAllTextAsync(entry.S("destination")) == "CONTEÚDO PRESERVADO", "Native transfer preserves content");
        await bridge.Call("history:undo", entry.S("id"));
        Check(await File.ReadAllTextAsync(source) == "CONTEÚDO PRESERVADO", "Undo restores the test file through the native journal");
        preview = await bridge.Call("preview:scan", id);
        var group = preview!["review"].Items("groups").First();
        Check(group["suggestion"].S("name") == "Design", "WPF retains metadata-only Design suggestions");
        var sink = new RecycleBin.RecycleSink();
        Check(sink.PreDeleteItem(0, null!) < 0, "Recycle sink vetoes permanent deletion");
        Click(Find(window, "Analisar"));
        await Wait(() => ((StackPanel)window.FindName("Navigation")).IsEnabled);
        grid = Children<DataGrid>(window).First();
        foreach (var item in grid.Items.OfType<PreviewItem>())
            item.Selected = item.Name == "nota.pdf";
        await DriveDialog(window, "Organizar", _ => File.WriteAllText(source, "alterado após a confirmação"));
        grid = Children<DataGrid>(window).First();
        var failedRow = grid.Items.OfType<PreviewItem>().First(r => r.Name == "nota.pdf");
        Check(File.Exists(source) && failedRow.Selected && failedRow.Failure.Length > 0, "Changed files remain selected with a failure reason after the batch");
        Check(((TextBlock)window.FindName("PageTitle")).Text == "Pastas" && Children<ComboBox>(window).Any(picker => System.Windows.Automation.AutomationProperties.GetName(picker) == "Pasta atual"), "Partial failure preserves the workspace");
        await File.WriteAllTextAsync(source, "CONTEÚDO PRESERVADO");
        File.SetLastWriteTimeUtc(source, DateTime.UtcNow.AddMinutes(-10));
        Click(Find(window, "Analisar"));
        await Wait(() => ((StackPanel)window.FindName("Navigation")).IsEnabled);
        grid = Children<DataGrid>(window).First();
        foreach (var item in grid.Items.OfType<PreviewItem>())
            item.Selected = true;
        await DriveDialog(window, "Enviar selecionados à Lixeira", _ => { });
        Check(!File.Exists(unknown) && !File.Exists(source), "UI bulk recycling handles classified and unmatched formats together");
        Check(((TextBlock)window.FindName("PageTitle")).Text == "Pastas" && Children<ComboBox>(window).Any(picker => System.Windows.Automation.AutomationProperties.GetName(picker) == "Pasta atual"), "Bulk recycling stays in the folder workspace");
        Check(Children<DataGrid>(window).First().Items.Count == 0, "Post-recycle preview is valid and empty");
        history = await bridge.Call("history:list");
        Check(history!.Items("entries").Count(e => e.S("effectiveStatus") == "trashed") == 2, "History records both recycled files without forced navigation");
        window.Width = 1280;
        window.Height = 850;
        Children<RadioButton>(window).First(button => Equals(button.Tag, AppPage.History)).IsChecked = true;
        await Wait(() => Children<TextBlock>(window).Any(text => text.Text == "Hoje"));
        Check(!Children<Button>(window).Any(button => button.Content is string label && (label == "Abrir Lixeira" || label == "Mostrar no Explorador")), "History replaces repeated action labels with accessible icons");
        var historySearch = Children<Organiza.Wpf.Presentation.Controls.SearchField>(window).Single();
        Check(historySearch.Tag?.ToString() == "Buscar" && historySearch.Width <= 280, "History has one compact contextual search field");
        var counter = Children<TextBlock>(window).Single(text => text.Text == "1 de 1");
        var pagination = VisualTreeHelper.GetParent(counter) as Grid;
        Check(counter.TextWrapping == TextWrapping.NoWrap && pagination?.ColumnDefinitions.Count == 3, "Pagination keeps arrows and counter in separate automatic columns without wrapping");
        var centers = pagination!.Children.OfType<FrameworkElement>().Select(control => control.TranslatePoint(new Point(0, control.ActualHeight / 2), window).Y).ToArray();
        Check(centers.Max() - centers.Min() <= 1, "Pagination arrows and counter share the same vertical center");
        var recycledButtons = Children<Button>(window).Where(button => System.Windows.Automation.AutomationProperties.GetName(button) == "Abrir Lixeira").ToList();
        Check(recycledButtons.Count == 2 && recycledButtons.All(button => Equals(button.Foreground, Application.Current.FindResource("ShadeDangerBrush"))), "Every recycle action uses the shared red icon style");
        await Save(window, Path.Combine(output, "history-populated.png"));
        Children<RadioButton>(window).First(button => Equals(button.Tag, AppPage.Settings)).IsChecked = true;
        await Task.Delay(150);
        var confirm = Children<CheckBox>(window).First(box => System.Windows.Automation.AutomationProperties.GetName(box) == "Confirmar remoção de pastas");
        confirm.IsChecked = false;
        await Wait(() => ((StackPanel)window.FindName("Navigation")).IsEnabled);
        Check(!(await client.GetState())!["settings"].B("confirmRemoval"), "Redesigned settings save the changed preference through the engine");
        Check(client.ProfileDirectory == Path.Combine(root, "profile"), "Local-data action receives the active profile rather than a hardcoded user path");
        Children<RadioButton>(window).First(button => Equals(button.Tag, AppPage.Overview)).IsChecked = true;
        await Task.Delay(200);
        await Save(window, Path.Combine(output, "overview-activity.png"));
        preview = await bridge.Call("preview:scan", id);
        await client.ActivateMonitoring(new[] { id });
        Check((await bridge.Call("state:get"))!["monitor"].Items("activeIds").Any(), "Monitoring activates after a reviewed preview");
        await bridge.Call("monitor:pause-all");
        window.Close();
        await Wait(() => !window.IsVisible);
        var reopened = await EngineBridge.Start(applicationRoot, Path.Combine(root, "profile"));
        state = await reopened.Call("state:get");
        Check(!state!["monitor"].Items("activeIds").Any() && state.Items("folders").Count() == 3, "Reopening preserves folders and respects the explicit manual choice");
        await reopened.Shutdown();
        Directory.Delete(root, true);
        Console.WriteLine($"{_count} native WPF/engine checks passed. All file operations used temporary files. The Windhawk/DWM appearance still requires physical inspection.");
    }
    private static async Task Save(Window window, string path)
    {
        await Task.Delay(300);
        window.UpdateLayout();
        // Public captures show fixtures without exposing the machine's profile path.
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var personalLabels = Children<TextBlock>(window)
            .Where(label => !string.IsNullOrEmpty(userProfile) && label.Text.Contains(userProfile, StringComparison.OrdinalIgnoreCase))
            .Select(label => (Label: label, Original: label.Text)).ToArray();
        foreach (var item in personalLabels)
            item.Label.SetCurrentValue(TextBlock.TextProperty, item.Original.Replace(userProfile, "%USERPROFILE%", StringComparison.OrdinalIgnoreCase));
        try
        {
            window.UpdateLayout();
            var root = (FrameworkElement)window.Content;
            var image = new RenderTargetBitmap((int)root.ActualWidth, (int)root.ActualHeight, 96, 96, PixelFormats.Pbgra32);
            image.Render(root);
            var flat = new DrawingVisual();
            using (var context = flat.RenderOpen())
            {
                context.DrawRectangle((Brush)Application.Current.FindResource("ShadeBackgroundBrush"), null, new Rect(0, 0, image.Width, image.Height));
                context.DrawImage(image, new Rect(0, 0, image.Width, image.Height));
            }
            var result = new RenderTargetBitmap(image.PixelWidth, image.PixelHeight, 96, 96, PixelFormats.Pbgra32);
            result.Render(flat);
            var png = new PngBitmapEncoder();
            png.Frames.Add(BitmapFrame.Create(result));
            using var stream = File.Create(path);
            png.Save(stream);
        }
        finally
        {
            foreach (var item in personalLabels)
                item.Label.SetCurrentValue(TextBlock.TextProperty, item.Original);
        }
    }
}
