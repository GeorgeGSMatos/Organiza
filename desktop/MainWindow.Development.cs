#if DEBUG
using System.Windows;
using Organiza.Wpf.Development;
using Organiza.Wpf.Navigation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    internal bool CanApplyDevelopmentChange => !_working && !_engineBusy && !_scanning && _dialogDepth == 0 && !_menuOpen && !_closing;

    internal void EnableDevelopment(bool hidden)
    {
        IsDevelopment = true;
        Title = "Organiza · Desenvolvimento";
        ApplicationName.Text = Title;
        if (hidden) { WindowStartupLocation = WindowStartupLocation.Manual; Left = -20000; Top = -20000; ShowInTaskbar = false; ShowActivated = false; }
    }

    internal void RefreshDevelopmentView() { Render(); UiMotion.Enter(PageContent); }
    internal void DevelopmentMessage(string message) => OperationStatus.Message = message;
    internal object DevelopmentStatus() => new { pid = Environment.ProcessId, page = _navigation.Page.ToString(), folder = _navigation.FolderId, title = PageTitle.Text, subtitle = PageSubtitle.Text, titleSize = PageTitle.FontSize, idle = CanApplyDevelopmentChange };

    internal DevelopmentViewState CaptureDevelopmentState() => new()
    {
        Page = _navigation.Page, FolderId = _navigation.FolderId, PreviewQuery = _previewQuery, PreviewFilter = _filter,
        RuleQuery = _ruleQuery, History = _historyFilters, HadPreview = _preview is not null,
        SelectedIds = _rows.Where(row => row.Selected).Select(row => row.Id).ToArray(),
        Width = Width, Height = Height, Left = Left, Top = Top
    };

    internal async Task RestoreDevelopmentState(DevelopmentViewState state)
    {
        Width = Math.Clamp(state.Width, MinWidth, Math.Max(MinWidth, SystemParameters.VirtualScreenWidth));
        Height = Math.Clamp(state.Height, MinHeight, Math.Max(MinHeight, SystemParameters.VirtualScreenHeight));
        var bounds = new Rect(SystemParameters.VirtualScreenLeft, SystemParameters.VirtualScreenTop, SystemParameters.VirtualScreenWidth, SystemParameters.VirtualScreenHeight);
        if (bounds.IntersectsWith(new Rect(state.Left, state.Top, Width, Height))) { Left = state.Left; Top = state.Top; }
        if (Folders.FirstOrDefault(folder => folder.S("id") == state.FolderId) is { } folder) OpenFolder(folder);
        _previewQuery = state.PreviewQuery; _filter = state.PreviewFilter; _ruleQuery = state.RuleQuery;
        _historyFilters.Query = state.History.Query; _historyFilters.FolderId = state.History.FolderId;
        _historyFilters.Period = state.History.Period; _historyFilters.Status = state.History.Status; _historyFilters.Page = state.History.Page;
        if (Enum.IsDefined(state.Page)) _navigation.Navigate(state.Page);
        if (state.HadPreview && Folder is not null)
        {
            _working = true; UpdateInteraction();
            try
            {
                await Scan(); var selected = state.SelectedIds.ToHashSet();
                foreach (var row in _rows) row.Selected = selected.Contains(row.Id);
            }
            finally { _working = false; UpdateInteraction(); Render(); }
        }
    }
}
#endif
