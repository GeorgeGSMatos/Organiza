using System.IO;
using System.Windows;
using System.Windows.Interop;
using Organiza.Wpf;

internal static class TrayLifecycleChecks
{
    public static async Task Run(string applicationRoot, Action<bool, string> check)
    {
        var profile = Path.Combine(Path.GetTempPath(), "organiza-tray-check-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(profile);
        var window = new MainWindow { Left = -20000, Top = -20000, ShowActivated = false, ShowInTaskbar = false };
        var closed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        window.Closed += (_, _) => closed.TrySetResult();
        try
        {
            window.EnableTray();
            new WindowInteropHelper(window).EnsureHandle();
            check(!window.IsVisible, "Tray startup creates a window handle without showing the window");
            var engine = await EngineBridge.Start(applicationRoot, profile);
            await window.Connect(engine);
            check(!window.IsVisible, "Connecting the engine does not show a background window");
            window.ShowFromTray();
            check(window.IsVisible, "Tray open restores the main window");
            window.Close();
            check(!window.IsVisible && !closed.Task.IsCompleted, "Closing the window hides it without terminating the engine");
            var state = await engine.Call("state:get");
            check(state is not null, "The engine remains available after the window is hidden");
            window.ShowFromTray();
            check(window.IsVisible, "A hidden window can be reopened");
            window.RequestExit();
            await closed.Task.WaitAsync(TimeSpan.FromSeconds(15));
            check(closed.Task.IsCompleted, "Explicit exit shuts down the engine and closes the window");
        }
        finally
        {
            if (!closed.Task.IsCompleted)
            {
                window.RequestExit();
                await closed.Task.WaitAsync(TimeSpan.FromSeconds(15));
            }
            Directory.Delete(profile, true);
        }
    }
}
