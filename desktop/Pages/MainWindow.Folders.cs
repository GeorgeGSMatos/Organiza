using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private bool IsAvailable(string id) => _state.Items("availability").FirstOrDefault(item => item.S("id") == id).B("available");
    private bool IsAutomatic(string id) => Folders.FirstOrDefault(folder => folder.S("id") == id).S("organizationMode") == "automatic";
    private bool IsMonitored(string id) => _state!["monitor"].Items("activeIds").Any(item => item.ToString() == id);

    private void FoldersPage()
    {
        Header(AppPage.Folders, Folder is null ? "Escolha uma pasta para começar." : "Pastas  /  " + Folder.S("name"),
            LabeledAction(AppIcon.Add, "Adicionar pasta", EditFolder, true));
        if (Folder is null)
        {
            EmptyFolders();
            return;
        }
        FolderWorkspace();
    }

    private void FolderWorkspace()
    {
        var folder = Folder!;
        var picker = Ui.FolderChoice("Pasta atual", Folders.Select(item => (item.S("id"), item.S("name"))), _navigation.FolderId, integrated: true);
        picker.SelectionChanged += (_, _) =>
        {
            if (Folders.FirstOrDefault(item => item.S("id") == Ui.Value(picker)) is { } selected)
                OpenFolder(selected);
        };
        var path = Ui.Ellipsis(folder.S("path"), TextRole.Caption, muted: true);
        path.Margin = DesignResources.Spacing("FolderPathMargin");
        var analyze = LabeledAction(AppIcon.Play, "Analisar", async () => { _failures.Clear(); await Scan(); }, true);
        analyze.IsEnabled = IsAvailable(_navigation.FolderId);
        if (!analyze.IsEnabled)
            analyze.ToolTip = "A pasta está indisponível. Edite o caminho no menu da pasta.";
        var explore = IconAction(AppIcon.Folder, "Abrir no Explorador", async () => _shell.Open(await Client.GetFolderPath(_navigation.FolderId)));
        var rules = LabeledAction(AppIcon.Rules, "Regras", () => { _navigation.ShowFolderRules(); return Task.CompletedTask; });
        foreach (var button in new[] { explore, rules, analyze })
        {
            button.SetResourceReference(FrameworkElement.HeightProperty, "ChoiceHeight");
            button.Margin = DesignResources.Spacing("FolderActionMargin");
        }
        explore.SetResourceReference(FrameworkElement.MinWidthProperty, "ChoiceHeight");
        analyze.Margin = new Thickness(0);
        var actions = Ui.Inline(explore, rules, analyze);
        var folderBar = Ui.Toolbar(picker, actions);
        folderBar.Margin = new Thickness(0);
        PageContent.Children.Add(folderBar);
        PageContent.Children.Add(path);
        var help = Ui.Icon(AppIcon.Help, "Como funciona a organização automática?", () => Execute(ShowHelp));
        help.MinHeight = 28;
        help.Padding = new Thickness(4);
        help.Margin = DesignResources.Spacing("FolderModeHelpMargin");
        var automatic = FolderModeControl(folder, help);
        automatic.Margin = new Thickness(0);
        PageContent.Children.Add(automatic);
        if (!folder["organization"].Items("rules").Any())
            PageContent.Children.Add(Ui.Card(Ui.Stack(Ui.Text("Como deseja organizar esta pasta?", TextRole.Subheading, bold: true),
                Ui.Actions(LabeledAction(AppIcon.Add, "Usar categorias sugeridas", async () => { Apply(await Client.AddPresetRules(_navigation.FolderId)); await Scan(); }),
                    Action("Criar regra", () => { _navigation.ShowFolderRules(); return RuleDialog(null); })))));
        PreviewPanel();
        _pageStatus = _preview is null ? (_scanning ? "Analisando arquivos" : "Aguardando análise") : (_preview.B("limited") || _preview.B("cancelled") || _preview.Items("warnings").Any() ? "Análise parcial" : "Análise concluída") + " · " + FilePresentation.Quantity(_rows.Count, "arquivo", "arquivos");
    }

    private void EmptyFolders() => PageContent.Children.Add(Ui.Card(Ui.Stack(
        Ui.Text("Um lugar para cada arquivo.", TextRole.Section, bold: true),
        Ui.Text("Adicione Downloads, My Drive ou qualquer pasta do Windows.", TextRole.Caption, true),
        LabeledAction(AppIcon.Add, "Escolher primeira pasta", EditFolder, true))));

    private void FolderCards(IEnumerable<JsonNode> folders)
    {
        var items = folders.ToList();
        if (items.Count == 0)
        {
            EmptyFolders();
            return;
        }
        PageContent.Children.Add(Ui.Cards(items.Select(FolderCard)));
    }

    private CheckBox FolderModeSwitch(JsonNode folder)
    {
        var id = folder.S("id");
        var control = Ui.Switch("Organização automática", IsAutomatic(id), enabled => Execute(async () =>
        {
            if (enabled) await MonitorDialog(id);
            else { await Client.PauseMonitoring(id); _notice = "Organização manual ativada."; _noticeIcon = AppIcon.Pause; _noticeTone = StatusTone.Manual; }
        }));
        control.Click += (_, args) => args.Handled = true;
        control.IsEnabled = IsAutomatic(id) || IsAvailable(id) && folder["organization"].Items("rules").Any(rule => rule.B("enabled") && rule.S("action") == "move");
        var issue = _state?["monitor"]?["issues"].S(id);
        control.ToolTip = !string.IsNullOrEmpty(issue) ? issue : control.IsEnabled
            ? "Modo salvo para esta pasta, inclusive após reiniciar o computador."
            : "Crie uma regra ativa de organização primeiro.";
        return control;
    }

    private StackPanel FolderModeControl(JsonNode folder, FrameworkElement? trailing = null)
    {
        var toggle = FolderModeSwitch(folder);
        toggle.Content = null;
        toggle.Margin = DesignResources.Spacing("FolderModeToggleMargin");
        toggle.VerticalAlignment = VerticalAlignment.Center;
        var mode = Ui.Status(StatusPresentation.FolderMode(IsAutomatic(folder.S("id"))));
        var controls = Ui.Inline(mode, toggle);
        if (trailing is not null) controls.Children.Add(trailing);
        controls.HorizontalAlignment = HorizontalAlignment.Left;
        controls.Margin = DesignResources.Spacing("FolderModeRowMargin");
        return controls;
    }

    private void AddFolderNotices(StackPanel content, JsonNode folder)
    {
        var id = folder.S("id");
        void Attention(string label, string? explanation = null)
        {
            var notice = Ui.Status(new StatusPresentation(AppIcon.Warning, label, StatusTone.Attention));
            notice.Margin = DesignResources.Spacing("FolderCardNoticeMargin");
            notice.ToolTip = explanation ?? label;
            content.Children.Add(notice);
        }
        if (!IsAvailable(id))
            Attention("Pasta indisponível", "Confira o caminho, a conexão e as permissões desta pasta.");
        else if (IsAutomatic(id) && !IsMonitored(id))
            Attention("Automação aguardando", _state?["monitor"]?["issues"].S(id, "A execução será retomada após a verificação da pasta."));
        if (_summaries.TryGetValue(id, out var summary) && summary.Review > 0)
            Attention(FilePresentation.Quantity(summary.Review, "arquivo para revisar", "arquivos para revisar"));
    }

    private Button FolderCard(JsonNode folder)
    {
        var id = folder.S("id");
        var menu = Ui.Icon(AppIcon.More, "Opções da pasta", () => { });
        var context = Ui.Flyout(menu, new FlyoutAction[] {
            new("Editar pasta", () => Execute(() => EditFolder(folder)), AppIcon.Edit),
            new("Abrir no Explorador", () => Execute(async () => _shell.Open(await Client.GetFolderPath(id))), AppIcon.Folder),
            new("Remover do Organiza", () => Execute(() => RemoveFolder(folder)), AppIcon.Trash, Danger: true) },
            integrated: _navigation.Page == AppPage.Overview);
        menu.Click += (_, e) => { e.Handled = true; context.IsOpen = !context.IsOpen; };
        context.Opened += (_, _) => _menuOpen = true;
        context.Closed += (_, _) => _menuOpen = false;
        var icon = Ui.Glyph(AppIcon.Folder, large: true);
        icon.Margin = new Thickness(0, 0, 16, 0);
        var heading = Ui.Toolbar(Ui.IconContent(icon, Ui.Ellipsis(folder.S("name"), TextRole.Section, bold: true)), menu);
        heading.Margin = new Thickness(0);
        var path = Ui.Ellipsis(folder.S("path"), TextRole.Caption, true);
        path.Margin = DesignResources.Spacing("FolderCardPathMargin");
        var content = Ui.Stack(heading, path, FolderModeControl(folder));
        AddFolderNotices(content, folder);
        var time = Ui.Text(_summaries.TryGetValue(id, out var last) ? "Analisada " + FilePresentation.RelativeTime(last.Time, DateTime.Now) : "Ainda não analisada", TextRole.Caption, true);
        var footer = Ui.Toolbar(time, Ui.Glyph(AppIcon.ChevronRight));
        footer.Margin = DesignResources.Spacing("FolderCardFooterMargin");
        content.Children.Add(Ui.Divider());
        content.Children.Add(footer);
        var card = Ui.Button(folder.S("name"), () => OpenFolder(folder));
        card.Style = Ui.Style("ClickableCard");
        card.Content = content;
        return card;
    }
}
