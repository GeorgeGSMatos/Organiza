using Organiza.Wpf.Services;

internal static class StartupCommandChecks
{
    public static void Run(Action<bool, string> check)
    {
        const string local = @"C:\Users\Example\AppData\Local\Programs\Organiza\Organiza.exe";
        check(StartupCommand.Build(local, null) == "\"" + local + "\" --background", "Local startup quotes the executable and requests background mode");
        foreach (var network in new[] { @"\\wsl.localhost\Ubuntu-24.04\home\example\Organiza.exe", @"\\wsl$\Ubuntu-24.04\home\example\Organiza.exe", @"\\server\share\Organiza.exe" })
        {
            check(StartupCommand.Build(network, local) == "\"" + local + "\" --background", "Network startup uses the local installation: " + network);
            var rejected = false;
            try { StartupCommand.Build(network, null); }
            catch (InvalidOperationException) { rejected = true; }
            check(rejected, "Network startup without a local installation requires installation: " + network);
        }
    }
}
