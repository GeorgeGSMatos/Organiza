using System.ComponentModel;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;
using Organiza.Wpf.Services;

namespace Organiza.Wpf;

public partial class MainWindow : Window
{
    internal bool IsDevelopment { get; private set; }
    private OrganizaClient? _client;
    private OrganizaClient Client => _client ?? throw new InvalidOperationException("O motor ainda está iniciando.");
    private readonly AppNavigation _navigation = new();
    private readonly WindowsShellService _shell = new();
    private readonly WindowsStartupService _startup = new();
    private JsonNode? _state, _preview, _history;
    private string _scope = "", _previewQuery = "", _filter = "all";
    private bool _working, _engineBusy, _refreshing, _closing, _allowClose, _menuOpen;
    private int _dialogDepth;
    private bool _loadingHistory;
    private bool _scanning;
    private string _notice = "", _pageStatus = "";
    private AppIcon _noticeIcon = AppIcon.Check;
    private StatusTone _noticeTone = StatusTone.Neutral;
    private readonly Dictionary<string, (int Review, DateTime Time)> _summaries = [];
    private readonly Dictionary<string, string> _failures = [];
    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromSeconds(30) };
    private readonly List<PreviewItem> _rows = [];
    private IEnumerable<JsonNode> Folders => _state.Items("folders");
    private JsonNode? Folder => Folders.FirstOrDefault(f => f.S("id") == _navigation.FolderId) ?? Folders.FirstOrDefault();
    public MainWindow()
    {
        InitializeComponent();
        InitializeNavigation();
        Closed += (_, _) =>
        {
            _tray?.Dispose();
            _timer.Stop();
            _client?.Dispose();
            _navigation.Changed -= NavigationChanged;
        };
        _timer.Tick += async (_, _) =>
        {
            if (!_working && _dialogDepth == 0 && IsVisible)
                await Refresh();
        };
        PreviewKeyDown += (_, e) =>
        {
            if (e.Key != Key.N || Keyboard.Modifiers != ModifierKeys.Control || _working || _dialogDepth > 0)
                return;
            Execute(EditFolder);
            e.Handled = true;
        };
    }
    public async Task Connect(IEngine engine)
    {
        _client?.Dispose();
        _client = new OrganizaClient(engine);
        _engineAvailable = true;
        _client.Exited += message => OnUiThread(() =>
        {
            _engineAvailable = false;
            _tray?.Update(0, false);
            ShowFromTray();
            ShowError(message);
            OperationStatus.Message = "Motor indisponível. Reabra o Organiza.";
        });
        _client.StateChanged += () => OnUiThread(() =>
        {
            if (!_working && _dialogDepth == 0)
                _ = Refresh();
        });
        _client.AnalysisProgress += progress => OnUiThread(() => OperationStatus.ShowProgress(ProgressDisplay.From(progress)));
        _client.OperationProgress += (busy, progress) => OnUiThread(() =>
        {
            _engineBusy = busy;
            UpdateInteraction();
            StopButton.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
            if (progress is not null)
                OperationStatus.ShowProgress(ProgressDisplay.From(progress));
            else if (!busy)
                OperationStatus.HideProgress();
        });
        await Refresh(false);
        _navigation.Navigate(AppPage.Overview);
        _timer.Start();
    }
    private void OnUiThread(Action action) => Dispatcher.BeginInvoke(new Action(() =>
    {
        if (!_closing)
            action();
    }));
    private void WindowLoaded(object sender, RoutedEventArgs e) => Material.Apply(this);
    private async Task Refresh(bool render = true)
    {
        if (_client is null || _refreshing || _closing)
            return;
        _refreshing = true;
        try
        {
            var next = await Client.GetState();
            var changed = _state?.ToJsonString() != next?.ToJsonString();
            Apply(next);
            if (render && changed && _dialogDepth == 0 && !_menuOpen && Keyboard.FocusedElement is not TextBox)
                Render();
        }
        catch (Exception error) { ShowError(error.Message); }
        finally { _refreshing = false; if (render) QueueFolderAnalysis(); }
    }
    private void Apply(JsonNode? next)
    {
        if (next is null)
            return;
        if (_state is not null && (!SameFolderConfiguration(_state["folders"], next["folders"]) || _state["history"].N("generation") != next["history"].N("generation")))
        {
            SetPreview(null);
            _automaticAnalysisFolder = "";
            _history = null;
            _summaries.Clear();
        }
        _state = next;
        _engineBusy = next["operation"].B("busy") || next["operation"].B("recovering");
        UpdateInteraction();
    }
    private async void Execute(Func<Task> action)
    {
        if (_working || _engineBusy || _closing)
        {
            OperationStatus.Message = "Aguarde a operação atual ou use Parar após este arquivo.";
            return;
        }
        _working = true;
        _notice = "";
        _noticeIcon = AppIcon.Check;
        _noticeTone = StatusTone.Neutral;
        Alert.Visibility = Visibility.Collapsed;
        Navigation.IsEnabled = false;
        PageActions.IsEnabled = false;
        PageContent.IsEnabled = false;
        try
        {
            await action();
        }
        catch (Exception error) { ShowError(error.Message); }
        finally
        {
            if (!_closing)
            {
                try { await Client.ReconcileMonitoring(); }
                catch (Exception error) { ShowError("Não foi possível retomar a automação: " + error.Message); }
            }
            _working = false;
            await Refresh(false);
            UpdateInteraction();
            OperationStatus.HideProgress();
            if (!_closing)
            {
                Render();
                QueueFolderAnalysis();
            }
        }
    }
    private void ShowError(string message) => ShowNotice(message, StatusTone.Error);
    private void ShowAttention(string message) => ShowNotice(message, StatusTone.Attention);

    private void ShowNotice(string message, StatusTone tone)
    {
        _notice = message;
        _noticeIcon = AppIcon.Warning;
        _noticeTone = tone;
        AlertText.Text = message;
        Alert.SetResourceReference(Border.BorderBrushProperty, StatusPresentation.BrushFor(tone));
        AlertText.SetResourceReference(TextBlock.ForegroundProperty, StatusPresentation.BrushFor(tone));
        Alert.Visibility = Visibility.Visible;
        OperationStatus.SetIdle(message, AppIcon.Warning, tone);
    }
    private bool Dialog(UiDialog dialog)
    {
        _dialogDepth++;
        try
        {
            return dialog.ShowDialog() == true;
        }
        finally { _dialogDepth--; }
    }
    private void Render()
    {
        if (_state is null)
            return;
        StopButton.Visibility = _engineBusy || _scanning ? Visibility.Visible : Visibility.Collapsed;
        StopButton.Content = _scanning ? "Cancelar análise" : "Parar após este arquivo";
        var offset = PageScroller.VerticalOffset;
        _pageStatus = "";
        PageContent.Children.Clear();
        PageActions.Children.Clear();
        _navigation.ReconcileFolders(Folders.Select(f => f.S("id")));
        switch (_navigation.Page)
        {
            case AppPage.Overview:
                Overview();
                break;
            case AppPage.Folders:
                FoldersPage();
                break;
            case AppPage.Rules:
                RulesPage();
                break;
            case AppPage.History:
                HistoryPage();
                break;
            case AppPage.Settings:
                SettingsPage();
                break;
        }
        var error = _state["history"].S("error");
        if (error.Length > 0)
            ShowError(error);
        else if (_state["history"].N("attention") > 0)
            ShowAttention("Há operações interrompidas para conferir no Histórico.");
        else if (_state.S("recoveryMessage").Length > 0)
            ShowAttention(_state.S("recoveryMessage"));
        else if (_state["monitor"]?["lastResult"] is { } result && (result.S("warning") + result.S("error")).Length > 0)
            ShowNotice("Monitoramento: " + result.S("warning") + result.S("error"), result.S("error").Length > 0 ? StatusTone.Error : StatusTone.Attention);
        if (_noticeTone != StatusTone.Error && _state["monitor"]?["issues"] is JsonObject issues && issues.Count > 0)
            ShowAttention("Automação aguardando: " + string.Join(" · ", issues.Select(issue => Folders.FirstOrDefault(folder => folder.S("id") == issue.Key).S("name") + ": " + issue.Value)));
        UpdateIdleStatus();
        PageScroller.ScrollToVerticalOffset(offset);
    }
    private void UpdateIdleStatus()
    {
        if (_working || _engineBusy || _scanning)
            return;
        var message = _notice.Length > 0 ? _notice : _pageStatus.Length > 0 ? _pageStatus : "Pronto";
        OperationStatus.SetIdle(message, _notice.Length > 0 ? _noticeIcon : _navigation.Page == AppPage.Overview ? AppIcon.Device : AppIcon.Check, _notice.Length > 0 ? _noticeTone : StatusTone.Neutral);
    }
    private void UpdateInteraction()
    {
        UpdateTray();
        Navigation.IsEnabled = !_working;
        PageContent.IsEnabled = PageActions.IsEnabled = !_working && !_engineBusy;
    }
    private Button LabeledAction(AppIcon icon, string label, Func<Task> action, bool primary = false) => Ui.LabeledIcon(icon, label, () => Execute(action), primary);
    private void Header(string title, string subtitle, params UIElement[] actions)
    {
        ContextHelp.Visibility = _navigation.Page is AppPage.Overview or AppPage.Rules ? Visibility.Visible : Visibility.Collapsed;
        ContextHelp.Content = _navigation.Page == AppPage.Rules ? "ⓘ  Como funcionam as regras?" : "ⓘ  Como organizar uma pasta?";
        PageTitle.Text = title;
        PageSubtitle.Text = subtitle;
        PageSubtitle.ToolTip = null;
        PageSubtitle.TextWrapping = TextWrapping.Wrap;
        foreach (var action in actions)
            PageActions.Children.Add(action);
    }
    private Button Action(string label, Func<Task> action, bool primary = false, bool danger = false) => Ui.Button(label, () => Execute(action), primary, danger);
    private Button IconAction(AppIcon icon, string label, Func<Task> action) => Ui.Icon(icon, label, () => Execute(action));
    private async void StopClick(object sender, RoutedEventArgs e)
    {
        try
        {
            await Client.Cancel();
            OperationStatus.Message = "Parando após concluir o arquivo atual…";
        }
        catch (Exception error) { ShowError(error.Message); }
    }
    private async void WindowClosing(object? sender, CancelEventArgs e)
    {
        if (_tray is not null && !_exitRequested)
        {
            e.Cancel = true;
            Hide();
            return;
        }
        if (_allowClose || _client is null)
            return;
        e.Cancel = true;
        if (_closing)
            return;
        _closing = true;
        _timer.Stop();
        OperationStatus.Message = "Concluindo o arquivo atual antes de sair…";
        try
        {
            await Client.Shutdown();
            _allowClose = true;
            Close();
        }
        catch (Exception error)
        {
            _closing = false;
            _exitRequested = false;
            _timer.Start();
            ShowFromTray();
            ShowError("Não foi possível concluir o encerramento: " + error.Message);
        }
    }
}
