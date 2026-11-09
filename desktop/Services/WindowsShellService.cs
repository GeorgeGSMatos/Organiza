using System.Diagnostics;
using System.IO;
using Microsoft.Win32;

namespace Organiza.Wpf.Services;

public sealed class WindowsShellService
{
    public void OpenContainingFolder(string file)
    {
        var folder = Path.GetDirectoryName(file);
        if (folder is null || !Directory.Exists(folder))
            throw new InvalidOperationException("A pasta de origem não está mais disponível.");
        Open(folder);
    }
    public void Open(string path, bool reveal = false)
    {
        var start = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "explorer.exe")) { UseShellExecute = true };
        if (reveal)
            start.Arguments = "/select,\"" + path.Replace("\"", "") + "\"";
        else
            start.ArgumentList.Add(path);
        Process.Start(start);
    }

    public string PickFolder(string initial = "")
    {
        var picker = new OpenFolderDialog { Title = "Escolha uma pasta", Multiselect = false };
        if (Directory.Exists(initial))
            picker.InitialDirectory = initial;
        return picker.ShowDialog() == true ? picker.FolderName : "";
    }
}
