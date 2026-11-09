using System.Windows;
using System.Windows.Interop;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Services;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private TrayService? _tray;
    private bool _exitRequested;
    private bool _engineAvailable;

    internal void EnableTray()
    {
        _tray = new TrayService(ShowFromTray, ToggleTrayMonitoring, RequestExit);
        SourceInitialized += (_, _) =>
        {
            if (PresentationSource.FromVisual(this) is HwndSource source) _tray.Attach(source);
        };
    }

    internal void ShowFromTray()
    {
        if (_closing) return;
        Show();
        if (WindowState == WindowState.Minimized) WindowState = WindowState.Normal;
        Activate();
        Material.Apply(this);
        if (_client is not null) _ = Refresh();
    }

    internal void PrepareSessionEnd() => _exitRequested = true;

    internal void RequestExit()
    {
        _exitRequested = true;
        Close();
    }

    internal async Task RestoreMonitoringOnStartup()
    {
        _working = true;
        UpdateInteraction();
        try
        {
            await Client.RestoreMonitoring();
            await Refresh();
        }
        catch (Exception error) { if (!_closing) { ShowFromTray(); ShowError(error.Message); } }
        finally { _working = false; UpdateInteraction(); UpdateTray(); }
    }

    private void UpdateTray()
    {
        var active = _state?["monitor"].Items("activeIds").Count() ?? 0;
        _tray?.Update(active, _engineAvailable && !_closing && (active > 0 || (!_working && !_engineBusy)));
    }

    private async void ToggleTrayMonitoring()
    {
        if (_state?["monitor"].Items("activeIds").Any() == true)
        {
            try { await Client.PauseAllMonitoring(); await Refresh(); }
            catch (Exception error) { ShowFromTray(); ShowError(error.Message); }
            return;
        }
        ShowFromTray();
        _navigation.Navigate(AppPage.Folders);
        if (!Folders.Any())
        {
            ShowError("Adicione uma pasta e configure suas regras antes de ativar o monitoramento.");
            return;
        }
        Execute(() => MonitorDialog(Folder?.S("id") ?? ""));
    }

    internal void DisposeTray() => _tray?.Dispose();
}
