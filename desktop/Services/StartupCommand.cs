namespace Organiza.Wpf.Services;

internal static class StartupCommand
{
    internal static string Build(string executable, string? installedExecutable)
    {
        // Network executables can trigger Windows security confirmation at every logon.
        // Prefer the local installation without changing Windows security-zone policies.
        if (executable.StartsWith(@"\\", StringComparison.Ordinal))
        {
            if (string.IsNullOrWhiteSpace(installedExecutable) || installedExecutable.StartsWith(@"\\", StringComparison.Ordinal))
                throw new InvalidOperationException("Para iniciar com o Windows, copie a pasta completa do Organiza para uma pasta local e abra o executável de lá.");
            executable = installedExecutable;
        }
        return "\"" + executable + "\" --background";
    }
}
