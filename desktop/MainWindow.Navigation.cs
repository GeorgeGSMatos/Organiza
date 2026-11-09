using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private bool _synchronizingNavigation;

    private void InitializeNavigation()
    {
        _navigation.Changed += NavigationChanged;
        foreach (var page in AppPages.All)
        {
            var icon = Ui.Glyph(page.Icon);
            icon.SetResourceReference(FrameworkElement.MarginProperty, "NavigationIconMargin");
            var content = new StackPanel { Orientation = Orientation.Horizontal };
            content.Children.Add(icon);
            content.Children.Add(new TextBlock { Text = page.Title, VerticalAlignment = VerticalAlignment.Center });
            var item = new RadioButton { Tag = page.Page, GroupName = "Navigation", Style = Ui.Style("NavigationItem"), Content = content };
            AutomationProperties.SetName(item, page.Title);
            item.Checked += (_, _) =>
            {
                if (_synchronizingNavigation)
                    return;
                if (page.Page == AppPage.Folders)
                    NavigateToFolders();
                else
                    _navigation.Navigate(page.Page);
            };
            Navigation.Children.Add(item);
        }
    }

    private void NavigationChanged(object? sender, EventArgs args)
    {
        _synchronizingNavigation = true;
        try
        {
            foreach (var item in Navigation.Children.OfType<RadioButton>())
                item.IsChecked = Equals(item.Tag, _navigation.Page);
        }
        finally { _synchronizingNavigation = false; }
        _notice = "";
        if (_state is null)
            return;
        Render();
        PageScroller.ScrollToTop();
        UiMotion.Enter(PageContent);
        QueueFolderAnalysis();
    }

    private void NavigateToFolders()
    {
        if (Folder is { } folder)
            OpenFolder(folder);
        else
            _navigation.ShowFolders();
    }

    private void OpenFolder(System.Text.Json.Nodes.JsonNode folder)
    {
        var id = folder.S("id");
        if (_scope != id)
        {
            SetPreview(null);
            _previewQuery = "";
            _filter = "all";
            _failures.Clear();
            _fileScroll = 0;
            _previewSort = nameof(PreviewItem.Name);
            _previewDirection = System.ComponentModel.ListSortDirection.Ascending;
            _detailRowId = "";
        }
        SetPreview(null);
        _retainedPreviewSelection.Clear();
        _automaticAnalysisFolder = "";
        _scope = id;
        _navigation.OpenFolder(id);
    }

    private void Header(AppPage page, string subtitle, params UIElement[] actions) => Header(AppPages.Get(page).Title, subtitle, actions);
}
