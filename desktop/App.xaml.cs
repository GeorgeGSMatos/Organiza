using System.Diagnostics;
using System.IO;
using System.Windows;
using Organiza.Wpf.Development;
using Organiza.Wpf.Services;

namespace Organiza.Wpf;

public partial class App : Application
{
    private FileStream? _profileLock;
    private readonly ThemeService _theme = new();
#if DEBUG
    private DevelopmentRuntime? _development;
#endif
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DevelopmentOptions? development = null;
        try
        {
            development = DevelopmentOptions.Parse(e.Args);
            // The Electron predecessor does not know the WPF lock. Refuse overlapping sessions.
            if (development is null && Process.GetProcessesByName("Organiza").Any(p => p.Id != Environment.ProcessId))
                throw new IOException("Feche a outra versão do Organiza antes de abrir esta.");
            var profile = development?.ProfileDirectory ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Organiza");
            Directory.CreateDirectory(profile);
            _profileLock = new FileStream(Path.Combine(profile, "wpf-session.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            _theme.Apply(this, true);
            _theme.Start();
            var window = new MainWindow();
#if DEBUG
            if (development is not null) window.EnableDevelopment(development.Hidden);
#endif
            MainWindow = window;
            SessionEnding += (_, _) => window.PrepareSessionEnd();
            if (development is null) window.EnableTray();
            if (development is not null || !e.Args.Contains("--background")) window.Show();
            else new System.Windows.Interop.WindowInteropHelper(window).EnsureHandle();
            _theme.ThemeChanged += (_, _) => Dispatcher.Invoke(() => { _theme.Apply(this, true); Material.Apply(window); });
            var engine = await EngineBridge.Start(AppContext.BaseDirectory, profile);
#if DEBUG
            if (development is not null)
            {
                using var setup = new OrganizaClient(engine);
                await DevelopmentExamples.Seed(setup, development);
            }
#endif
            await window.Connect(engine);
            if (development is null) await window.RestoreMonitoringOnStartup();
#if DEBUG
            if (development is not null)
            {
                _development = new DevelopmentRuntime(window, development, () => { _theme.Apply(this, true); Material.Apply(window); });
                await _development.Start();
            }
#endif
        }
        catch (Exception error)
        {
            if (development is not null)
            {
                Console.Error.WriteLine(error);
                File.WriteAllText(Path.Combine(development.ControlDirectory, "startup-error.txt"), error.ToString());
            }
            else MessageBox.Show(error.Message, "Não foi possível abrir o Organiza", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(1);
        }
    }
    protected override void OnExit(ExitEventArgs e)
    {
#if DEBUG
        _development?.Dispose();
#endif
        (MainWindow as MainWindow)?.DisposeTray();
        _theme.Dispose();
        _profileLock?.Dispose();
        base.OnExit(e);
    }
}
