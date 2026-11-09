using System.Runtime.InteropServices;
using System.Windows;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private Task ShowAboutDetails()
    {
        var report = string.Join(Environment.NewLine,
            "Organiza · Versão " + _state.S("appVersion"),
            "Licença proprietária · George GS Matos · Todos os direitos reservados.",
            "Windows: " + RuntimeInformation.OSDescription,
            "Ambiente: " + RuntimeInformation.FrameworkDescription,
            "Arquitetura: " + RuntimeInformation.ProcessArchitecture,
            "Perfil: " + (Client.ProfileDirectory ?? "Indisponível"),
            "Pastas cadastradas: " + Folders.Count(),
            "Pastas em organização automática: " + Folders.Count(folder => folder.S("organizationMode") == "automatic"),
            "Histórico: " + (_state?["history"].S("error") is { Length: > 0 } error ? error : "Disponível"));
        var dialog = new UiDialog(this, "Informações e diagnóstico", "Versão, licença e informações locais para suporte.",
            "Fechar", () => Task.CompletedTask, informational: true, integrated: true, headingIcon: AppIcon.Info);
        dialog.Body.Children.Add(Ui.Text(report, TextRole.Body));
        var copy = Ui.Button("Copiar diagnóstico", () =>
        {
            try { Clipboard.SetText(report); }
            catch (ExternalException error)
            {
                dialog.Error.Text = "Não foi possível copiar o diagnóstico: " + error.Message;
                dialog.Error.Visibility = Visibility.Visible;
            }
        });
        dialog.Body.Children.Add(copy);
        Dialog(dialog);
        return Task.CompletedTask;
    }
}
