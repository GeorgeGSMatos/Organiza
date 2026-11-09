using System.IO;
using Microsoft.Win32;

namespace Organiza.Wpf.Services;

public sealed class WindowsStartupService
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string EntryName = "Organiza";

    public bool IsEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey);
            return key?.GetValue(EntryName) is string value && value.Contains(EntryName, StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception error) when (error is System.Security.SecurityException or UnauthorizedAccessException or System.IO.IOException)
        {
            throw new InvalidOperationException("Não foi possível consultar a inicialização automática no Windows.", error);
        }
    }

    public async Task Save(bool enabled, Func<Task> persistPreference)
    {
        using var key = Registry.CurrentUser.CreateSubKey(RunKey, true);
        var previous = key.GetValue(EntryName);
        try
        {
            if (enabled)
            {
                var executable = Environment.ProcessPath
                    ?? throw new InvalidOperationException("Não foi possível identificar o executável do Organiza.");
                var installed = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Organiza", "Organiza.exe");
                key.SetValue(EntryName, StartupCommand.Build(executable, File.Exists(installed) ? installed : null));
            }
            else
                key.DeleteValue(EntryName, false);
            if (IsEnabled() != enabled)
                throw new InvalidOperationException("O Windows não confirmou a preferência.");
            await persistPreference();
        }
        catch
        {
            if (previous is null)
                key.DeleteValue(EntryName, false);
            else
                key.SetValue(EntryName, previous);
            throw;
        }
    }
}
