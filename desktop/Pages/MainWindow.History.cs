using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private const int HistoryPageSize = 50;
    private readonly HistoryFilters _historyFilters = new();
    private static readonly GridLength[] HistoryColumns = [new(70), new(1.4, GridUnitType.Star), new(1.3, GridUnitType.Star), new(1, GridUnitType.Star), new(88)];

    private void HistoryPage()
    {
        Header(AppPage.History, "Suas ações, registradas.");
        if (_history is null)
        {
            PageContent.Children.Add(Ui.Text("Carregando histórico…", TextRole.Caption, true));
            _ = LoadHistory();
            return;
        }
        var records = _history.Items("entries").Select(entry => new HistoryRecord(entry)).OrderByDescending(record => record.Time ?? DateTimeOffset.MinValue).ToList();
        var folders = Folders.Select(folder => (Id: folder.S("id"), Name: folder.S("name")))
            .Concat(records.Select(record => (Id: record.FolderId, Name: record.FolderName))).Where(item => item.Id.Length > 0).DistinctBy(item => item.Id);
        var search = Ui.Search(_historyFilters.Query, "Buscar no histórico", compact: true);
        search.Margin = DesignResources.Spacing("HistoryFilterMargin");
        var folderFilter = Ui.Choice("Filtrar histórico por pasta", new[] { ("", "Todas as pastas") }.Concat(folders), _historyFilters.FolderId);
        var period = Ui.Choice("Período do histórico", [("today", "Hoje"), ("week", "Últimos 7 dias"), ("month", "Últimos 30 dias"), ("all", "Todo o período")], _historyFilters.Period);
        foreach (var choice in new[] { folderFilter, period })
        {
            choice.SetResourceReference(FrameworkElement.StyleProperty, "CompactChoice");
            choice.Margin = DesignResources.Spacing("HistoryFilterMargin");
            Ui.IntegrateDropdown(choice);
        }
        var refresh = IconAction(AppIcon.Refresh, "Conferir e atualizar histórico", async () => { _history = await Client.RecoverHistory(); });
        refresh.SetResourceReference(FrameworkElement.HeightProperty, "CompactControlHeight");
        refresh.SetResourceReference(FrameworkElement.MinHeightProperty, "CompactControlHeight");
        refresh.SetResourceReference(Control.PaddingProperty, "HistoryRefreshPadding");
        refresh.Margin = DesignResources.Spacing("HistoryFilterMargin");
        var filterBar = new WrapPanel();
        foreach (var control in new UIElement[] { search, folderFilter, period, refresh })
            filterBar.Children.Add(control);
        filterBar.Margin = new Thickness(0, 0, 0, 18);
        PageContent.Children.Add(filterBar);
        PageContent.Children.Add(Ui.Tabs([new("all", "Tudo"), new("organized", "Organizados"), new("trash", "Lixeira"), new("attention", "Atenção")], _historyFilters.Status,
            status => { _historyFilters.Status = status; _historyFilters.Page = 0; Render(); }));
        PageContent.Children.Add(Ui.Divider());
        var entries = new StackPanel { Margin = new Thickness(0, 20, 0, 12) };
        var pageInfo = Ui.Text("", TextRole.Caption, true);
        pageInfo.TextWrapping = TextWrapping.NoWrap;
        pageInfo.VerticalAlignment = VerticalAlignment.Center;
        pageInfo.Margin = DesignResources.Spacing("HistoryPageCounterMargin");
        var previous = Ui.Icon(AppIcon.Back, "Página anterior", () => { });
        var next = Ui.Icon(AppIcon.ChevronRight, "Próxima página", () => { });
        foreach (var button in new[] { previous, next })
        {
            button.Margin = new Thickness(0);
            button.SetResourceReference(FrameworkElement.HeightProperty, "CompactControlHeight");
            button.SetResourceReference(FrameworkElement.MinHeightProperty, "CompactControlHeight");
            button.VerticalAlignment = VerticalAlignment.Center;
        }
        void Draw()
        {
            entries.Children.Clear();
            var matches = _historyFilters.Apply(records, DateTime.Today).ToList();
            var pages = Math.Max(1, (matches.Count + HistoryPageSize - 1) / HistoryPageSize);
            _historyFilters.Page = Math.Clamp(_historyFilters.Page, 0, pages - 1);
            previous.IsEnabled = _historyFilters.Page > 0;
            next.IsEnabled = _historyFilters.Page + 1 < pages;
            pageInfo.Text = $"{_historyFilters.Page + 1} de {pages}";
            _pageStatus = FilePresentation.Quantity(matches.Count, "registro", "registros");
            UpdateIdleStatus();
            var visible = matches.Skip(_historyFilters.Page * HistoryPageSize).Take(HistoryPageSize);
            foreach (var day in visible.GroupBy(record => record.Time?.Date))
            {
                var label = day.Key == DateTime.Today ? "Hoje" : day.Key == DateTime.Today.AddDays(-1) ? "Ontem" : day.Key?.ToString("dd/MM/yyyy") ?? "Sem data";
                entries.Children.Add(Ui.Section(label));
                var table = new StackPanel();
                var heading = Ui.TableRow(HistoryColumns, Ui.Text("Horário", TextRole.Caption, true), Ui.Text("Arquivo", TextRole.Caption, true), Ui.Text("Ação", TextRole.Caption, true), Ui.Text("Pasta", TextRole.Caption, true), Ui.Text("Ações", TextRole.Caption, true));
                table.Children.Add(new Border { Child = heading, Padding = DesignResources.Spacing("HistoryRowPadding") });
                foreach (var record in day)
                {
                    table.Children.Add(Ui.Divider());
                    table.Children.Add(HistoryRow(record));
                }
                var panel = Ui.Card(table);
                panel.Padding = new Thickness(0);
                entries.Children.Add(panel);
            }
            if (matches.Count == 0)
            {
                entries.Children.Add(Ui.Text("Nenhum registro corresponde aos filtros.", TextRole.Caption, true));
                entries.Children.Add(Ui.Link("Limpar filtros", () => { _historyFilters.Clear(); Render(); }));
            }
        }
        search.TextChanged += (_, _) => { _historyFilters.Query = search.Text; _historyFilters.Page = 0; Draw(); };
        folderFilter.SelectionChanged += (_, _) => { _historyFilters.FolderId = Ui.Value(folderFilter); _historyFilters.Page = 0; Draw(); };
        period.SelectionChanged += (_, _) => { _historyFilters.Period = Ui.Value(period); _historyFilters.Page = 0; Draw(); };
        previous.Click += (_, _) => { _historyFilters.Page--; Draw(); };
        next.Click += (_, _) => { _historyFilters.Page++; Draw(); };
        PageContent.Children.Add(entries);
        var pagination = new Grid { HorizontalAlignment = HorizontalAlignment.Right };
        foreach (var element in new FrameworkElement[] { previous, pageInfo, next })
        {
            var column = pagination.ColumnDefinitions.Count;
            pagination.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            Grid.SetColumn(element, column);
            pagination.Children.Add(element);
        }
        PageContent.Children.Add(pagination);
        Draw();
    }

    private Border HistoryRow(HistoryRecord record)
    {
        var icon = Ui.Glyph(FilePresentation.TypeIcon(record.Source.S("type")));
        icon.Margin = new Thickness(0, 0, 12, 0);
        var file = Ui.IconContent(icon, Ui.Ellipsis(record.Name, TextRole.Caption));
        file.ToolTip = record.FilePath;
        var status = Ui.Status(FilePresentation.DescribeStatus(record.Status));
        var detail = Ui.Stack(status);
        if (record.NeedsAttention)
        {
            var reason = Ui.Ellipsis(record.Message, TextRole.Caption, true);
            reason.Margin = new Thickness(24, 6, 0, 0);
            detail.Children.Add(reason);
        }
        var actions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        if (record.IsRecycled)
        {
            actions.Children.Add(Ui.Icon(AppIcon.Trash, "Abrir Lixeira", () => _shell.Open("shell:RecycleBinFolder")));
            actions.Children.Add(IconAction(AppIcon.Folder, "Abrir pasta de origem", async () => _shell.OpenContainingFolder(await Client.GetHistoryPath(record.Id, true))));
        }
        else if (record.CanUndo)
        {
            actions.Children.Add(IconAction(AppIcon.Folder, "Mostrar no Explorador", async () => _shell.Open(await Client.GetHistoryPath(record.Id, false), true)));
            actions.Children.Add(IconAction(AppIcon.Undo, "Desfazer movimentação", async () =>
            {
                if (!Dialog(new UiDialog(this, "Desfazer movimentação?", record.Name + "\nO conteúdo precisa estar inalterado e a origem livre.", "Desfazer", () => Task.CompletedTask)))
                    return;
                await Client.Undo(record.Id);
                _history = await Client.GetHistory();
                _notice = "Movimentação desfeita.";
            }));
        }
        else
            actions.Children.Add(IconAction(AppIcon.Info, "Detalhes da operação", () => HistoryDetails(record)));
        var row = Ui.TableRow(HistoryColumns, Ui.Text(record.Time?.ToString("HH:mm") ?? "—", TextRole.Caption, true), file, detail,
            Ui.Ellipsis(record.FolderLabel, TextRole.Caption, true), actions);
        return new Border { Child = row, Style = Ui.Style("HistoryRow"), Padding = DesignResources.Spacing("HistoryRowPadding") };
    }

    private Task HistoryDetails(HistoryRecord record)
    {
        var dialog = new UiDialog(this, record.Name, FilePresentation.StatusLabel(record.Status), "Fechar", () => Task.CompletedTask, informational: true);
        dialog.Body.Children.Add(Ui.Text(record.Message, TextRole.Caption, true));
        dialog.Body.Children.Add(Ui.Field("Origem", Ui.Text(record.FilePath, TextRole.Caption, true)));
        if (!record.IsTrashOperation)
            dialog.Body.Children.Add(Ui.Field("Destino", Ui.Text(record.Destination, TextRole.Caption, true)));
        Dialog(dialog);
        return Task.CompletedTask;
    }

    private async Task LoadHistory()
    {
        if (_loadingHistory)
            return;
        _loadingHistory = true;
        try
        {
            _history = await Client.GetHistory();
            if (_navigation.Page is AppPage.History or AppPage.Overview)
                Render();
        }
        catch (Exception error) { ShowError(error.Message); }
        finally { _loadingHistory = false; }
    }
}
