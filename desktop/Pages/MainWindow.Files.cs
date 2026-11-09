using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private string _detailRowId = "";

    private void PreviewPanel()
    {
        if (_preview is null)
        {
            var loading = _scanning || _automaticAnalysisFolder != _navigation.FolderId;
            var empty = Ui.Stack(Ui.Text(loading ? "Carregando arquivos da pasta." : "Não foi possível carregar os arquivos.", TextRole.Subheading, bold: true),
                Ui.Text(loading ? "A análise começa ao abrir a pasta." : "Confira o aviso acima e use Analisar para tentar novamente.", TextRole.Caption, true));
            var card = Ui.Card(empty);
            card.Margin = new Thickness(0, 20, 0, 0);
            PageContent.Children.Add(card);
            return;
        }
        var body = new StackPanel { Margin = new Thickness(0, 14, 0, 0) };
        if (_preview.B("limited") || _preview.B("cancelled") || _preview.Items("warnings").Any())
            body.Children.Add(Ui.Text("Análise parcial · " + string.Join(" · ", _preview.Items("warnings").Select(item => item.ToString())) + (_preview.B("cancelled") ? " · Cancelada" : ""), TextRole.Caption, true));
        var filters = new[] { ("all", "Todos"), ("ready", "Prontos"), ("review", "Revisar"), ("ignored", "Ignorados") }
            .Select(item => new FilterOption(item.Item1, item.Item2, _rows.Count(row => item.Item1 == "all" || (item.Item1 == "review" ? row.Source.S("status") is "review" or "conflict" : row.Source.S("status") == item.Item1))));
        var tabs = Ui.Tabs(filters, _filter, filter => { _filter = filter; _fileScroll = 0; Render(); });
        var search = Ui.Search(_previewQuery, "Buscar arquivos", compact: true);
        search.Tag = "Buscar arquivos";
        search.Margin = DesignResources.Spacing("FileSearchMargin");
        body.Children.Add(search);
        body.Children.Add(tabs);
        body.Children.Add(Ui.Divider());
        var grid = CreateFileGrid();
        _previewGrid = grid;
        var all = (CheckBox)grid.Columns[0].Header;
        var selection = Ui.Text("", TextRole.Caption);
        var organize = LabeledAction(AppIcon.Folder, "Organizar", OrganizeSelected, true);
        var assign = Action("Definir categoria", AssignSelected);
        var trash = IconAction(AppIcon.Trash, "Enviar selecionados à Lixeira", TrashSelected);
        Action clearSelection = () => { };
        var clear = Ui.Icon(AppIcon.Clear, "Limpar seleção", () => clearSelection());
        var toolbar = Ui.Toolbar(selection, Ui.Inline(organize, assign, trash, clear));
        toolbar.Margin = new Thickness(0);
        var bar = new Border { Child = toolbar, Padding = DesignResources.Spacing("TablePadding") };
        bool syncing = false, selecting = false;
        void UpdateSelection()
        {
            if (selecting)
                return;
            var selected = _rows.Where(row => row.Selected).ToList();
            var visible = VisibleRows().ToList();
            var ids = visible.Select(row => row.Id).ToHashSet();
            var hidden = selected.Count(row => !ids.Contains(row.Id));
            selection.Text = FilePresentation.Quantity(selected.Count, "selecionado", "selecionados") + (hidden > 0 ? $" · {hidden} fora do filtro" : "");
            bar.Visibility = selected.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
            organize.IsEnabled = selected.Count > 0 && selected.All(row => row.CanMove);
            organize.ToolTip = organize.IsEnabled ? "Organizar a seleção" : "Defina destinos e resolva conflitos antes de organizar";
            assign.IsEnabled = selected.Count > 0 && selected.All(IsUnmatched);
            assign.ToolTip = assign.IsEnabled ? "Escolher destino para arquivos sem regra" : "Disponível para arquivos sem regra. Use Revisar para resolver conflitos.";
            trash.IsEnabled = selected.Count > 0 && selected.All(row => row.Source.S("status") != "ignored" && row.Source.S("ignoreReason").Length == 0);
            ToolTipService.SetShowOnDisabled(assign, true);
            ToolTipService.SetShowOnDisabled(organize, true);
            syncing = true;
            all.IsChecked = visible.Count > 0 && visible.All(row => row.Selected);
            syncing = false;
        }
        foreach (var row in _rows)
            row.Updated = UpdateSelection;
        clearSelection = () => { selecting = true; foreach (var row in _rows) row.Selected = false; selecting = false; UpdateSelection(); };
        void SelectVisible(bool value)
        {
            if (syncing)
                return;
            selecting = true;
            foreach (var row in VisibleRows().ToList())
                row.Selected = value;
            selecting = false;
            UpdateSelection();
        }
        all.Checked += (_, _) => SelectVisible(true);
        all.Unchecked += (_, _) => SelectVisible(false);
        var noMatches = Ui.Text("Nenhum arquivo corresponde a este filtro.", TextRole.Caption, true);
        noMatches.Margin = DesignResources.Spacing("TablePadding");
        var list = Ui.Card(Ui.Stack(bar, grid, noMatches));
        list.Padding = new Thickness(0);
        list.Margin = new Thickness(0);
        var details = new StackPanel();
        var detailCard = Ui.Card(details);
        detailCard.Padding = DesignResources.Spacing("FileDetailPadding");
        detailCard.VerticalAlignment = VerticalAlignment.Top;
        var layout = new Grid { Margin = new Thickness(0, 16, 0, 0) };
        layout.Children.Add(list);
        layout.Children.Add(detailCard);
        void Arrange()
        {
            layout.ColumnDefinitions.Clear();
            layout.RowDefinitions.Clear();
            if (body.ActualWidth >= DesignResources.Number("DetailBreakpoint"))
            {
                layout.ColumnDefinitions.Add(new ColumnDefinition());
                layout.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(detailCard.Visibility == Visibility.Visible ? DesignResources.Number("DetailWidth") : 0) });
                Grid.SetColumn(list, 0);
                Grid.SetColumn(detailCard, 1);
                Grid.SetRow(list, 0);
                Grid.SetRow(detailCard, 0);
                detailCard.Margin = DesignResources.Spacing("WorkspaceDetailMargin");
            }
            else
            {
                layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                layout.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                Grid.SetColumn(list, 0);
                Grid.SetColumn(detailCard, 0);
                Grid.SetRow(list, 0);
                Grid.SetRow(detailCard, 1);
                detailCard.Margin = DesignResources.Spacing("WorkspaceDetailStackMargin");
            }
        }
        grid.SelectionChanged += (_, _) =>
        {
            var row = grid.SelectedItem as PreviewItem;
            _detailRowId = row?.Id ?? "";
            FillFileDetails(details, row);
            detailCard.Visibility = row is null ? Visibility.Collapsed : Visibility.Visible;
        };
        void Draw()
        {
            var selectedDetailId = _detailRowId;
            var visible = VisibleRows().ToList();
            grid.ItemsSource = visible;
            var view = CollectionViewSource.GetDefaultView(grid.ItemsSource);
            view.SortDescriptions.Clear();
            view.SortDescriptions.Add(new SortDescription(_previewSort, _previewDirection));
            foreach (var column in grid.Columns)
                column.SortDirection = column.SortMemberPath == _previewSort ? _previewDirection : null;
            noMatches.Visibility = visible.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            var row = visible.FirstOrDefault(item => item.Id == selectedDetailId) ?? visible.FirstOrDefault(item => item.Selected) ?? visible.FirstOrDefault();
            grid.SelectedItem = row;
            if (row is null)
            {
                FillFileDetails(details, null);
                detailCard.Visibility = Visibility.Collapsed;
            }
            UpdateSelection();
            if (body.IsLoaded)
                Arrange();
        }
        grid.Sorting += (_, args) => { _previewSort = args.Column.SortMemberPath; _previewDirection = args.Column.SortDirection == ListSortDirection.Ascending ? ListSortDirection.Descending : ListSortDirection.Ascending; args.Handled = true; Draw(); };
        search.TextChanged += (_, _) => { _previewQuery = search.Text; _fileScroll = 0; Draw(); };
        grid.Loaded += (_, _) =>
        {
            if (GridScroll(grid) is not { } scroll)
                return;
            scroll.ScrollToVerticalOffset(_fileScroll);
            scroll.ScrollChanged += (_, args) => { if (args.VerticalChange != 0) _fileScroll = scroll.VerticalOffset; };
        };
        grid.MouseDoubleClick += (_, _) => { if (grid.SelectedItem is PreviewItem row && (IsUnmatched(row) || row.Source.Items("candidates").Count() > 1)) Execute(() => DecideRow(row)); };
        body.Children.Add(layout);
        body.Loaded += (_, _) => Arrange();
        body.SizeChanged += (_, args) => { if ((args.PreviousSize.Width >= DesignResources.Number("DetailBreakpoint")) != (args.NewSize.Width >= DesignResources.Number("DetailBreakpoint"))) Arrange(); };
        if (_preview["review"].N("deferredCount") > 0)
            body.Children.Add(Ui.Link("Retomar arquivos adiados", () => Execute(async () => ApplyReview(await Client.Resume(_preview.S("id"))))));
        Draw();
        PageContent.Children.Add(body);
    }

    private DataGrid CreateFileGrid()
    {
        var grid = new DataGrid
        {
            AutoGenerateColumns = false,
            CanUserAddRows = false,
            CanUserDeleteRows = false,
            CanUserResizeRows = false,
            HeadersVisibility = DataGridHeadersVisibility.Column,
            GridLinesVisibility = DataGridGridLinesVisibility.Horizontal,
            IsReadOnly = false,
            SelectionMode = DataGridSelectionMode.Single,
            BorderThickness = new Thickness(0)
        };
        grid.SetResourceReference(FrameworkElement.MinHeightProperty, "FileListMinHeight");
        grid.SetResourceReference(FrameworkElement.MaxHeightProperty, "FileListMaxHeight");
        grid.Background = Brushes.Transparent;
        grid.SetResourceReference(Control.ForegroundProperty, "ShadeTextBrush");
        grid.SetResourceReference(DataGrid.HorizontalGridLinesBrushProperty, "ShadeBorderBrush");
        var all = new CheckBox { ToolTip = "Selecionar arquivos do filtro atual" };
        System.Windows.Automation.AutomationProperties.SetName(all, "Selecionar arquivos do filtro atual");
        grid.Columns.Add(new DataGridTemplateColumn { Header = all, Width = 40, CanUserSort = false, CellTemplate = (DataTemplate)FindResource("FileSelectionCell") });
        grid.Columns.Add(new DataGridTemplateColumn { Header = "Arquivo", SortMemberPath = nameof(PreviewItem.Name), Width = new DataGridLength(1.4, DataGridLengthUnitType.Star), CellTemplate = (DataTemplate)FindResource("FileNameCell") });
        void Column(string label, string property, double width)
        {
            var style = new Style(typeof(TextBlock));
            style.Setters.Add(new Setter(TextBlock.TextTrimmingProperty, TextTrimming.CharacterEllipsis));
            style.Setters.Add(new Setter(TextBlock.ToolTipProperty, new Binding(property == nameof(PreviewItem.DestinationLabel) ? nameof(PreviewItem.Destination) : property)));
            grid.Columns.Add(new DataGridTextColumn { Header = label, Binding = new Binding(property), SortMemberPath = property == nameof(PreviewItem.Size) ? nameof(PreviewItem.SizeBytes) : property, ElementStyle = style, IsReadOnly = true, Width = new DataGridLength(width, DataGridLengthUnitType.Star) });
        }
        Column("Tipo", nameof(PreviewItem.Type), .75);
        Column("Tamanho", nameof(PreviewItem.Size), .65);
        grid.Columns.Add(new DataGridTemplateColumn { Header = "Situação", SortMemberPath = nameof(PreviewItem.Status), Width = new DataGridLength(.95, DataGridLengthUnitType.Star), CellTemplate = (DataTemplate)FindResource("FileStatusCell") });
        Column("Destino", nameof(PreviewItem.DestinationLabel), 1.1);
        return grid;
    }

    private static ScrollViewer? GridScroll(DependencyObject parent)
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
        {
            var child = VisualTreeHelper.GetChild(parent, index);
            if (child is ScrollViewer scroll)
                return scroll;
            if (GridScroll(child) is { } nested)
                return nested;
        }
        return null;
    }
}
