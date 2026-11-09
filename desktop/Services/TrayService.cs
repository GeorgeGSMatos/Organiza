using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Interop;
using Forms = System.Windows.Forms;

namespace Organiza.Wpf.Services;

public sealed class TrayService : IDisposable
{
    private readonly Forms.NotifyIcon _icon;
    private readonly Forms.ContextMenuStrip _menu = new();
    private readonly Forms.ToolStripMenuItem _monitor = new("Ativar monitoramento…");
    private readonly System.Drawing.Icon _image;
    private HwndSource? _source;
    private readonly uint _taskbarCreated = RegisterWindowMessage("TaskbarCreated");
    private bool _disposed;

    public TrayService(Action open, Action toggleMonitoring, Action exit)
    {
        var resource = System.Windows.Application.GetResourceStream(new Uri("pack://application:,,,/Assets/Organiza.ico"))
            ?? throw new InvalidOperationException("O ícone do Organiza não foi encontrado.");
        using (resource.Stream) _image = new System.Drawing.Icon(resource.Stream);
        _menu.Items.Add("Abrir Organiza", null, (_, _) => open());
        _monitor.Click += (_, _) => toggleMonitoring();
        _monitor.Enabled = false;
        _menu.Items.Add(_monitor);
        _menu.Items.Add(new Forms.ToolStripSeparator());
        _menu.Items.Add("Sair", null, (_, _) => exit());
        _icon = new Forms.NotifyIcon { Icon = _image, Text = "Organiza · Iniciando", ContextMenuStrip = _menu };
        _icon.MouseClick += (_, e) => { if (e.Button == Forms.MouseButtons.Left) open(); };
        _icon.Visible = true;
    }

    public void Attach(HwndSource source)
    {
        _source?.RemoveHook(WindowMessage);
        _source = source;
        source.AddHook(WindowMessage);
    }

    public void Update(int activeFolders, bool available)
    {
        if (_disposed) return;
        _icon.Text = activeFolders > 0 ? $"Organiza · {activeFolders} pasta(s) monitorada(s)" : "Organiza · Monitoramento pausado";
        _monitor.Text = activeFolders > 0 ? "Pausar monitoramento" : "Ativar monitoramento…";
        _monitor.Enabled = available;
    }

    private nint WindowMessage(nint hwnd, int message, nint wParam, nint lParam, ref bool handled)
    {
        if (!_disposed && _taskbarCreated != 0 && message == _taskbarCreated)
        {
            try { _icon.Visible = false; _icon.Visible = true; }
            catch (Exception error) { Trace.TraceWarning("Não foi possível restaurar o ícone da bandeja: {0}", error); }
        }
        return 0;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern uint RegisterWindowMessage(string message);

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _source?.RemoveHook(WindowMessage);
        _icon.Visible = false;
        _icon.Dispose();
        _menu.Dispose();
        _image.Dispose();
    }
}
