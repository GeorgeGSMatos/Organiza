using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using System.Windows.Data;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;
using Organiza.Wpf.Services;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private void SettingsPage()
    {
        Header(AppPage.Settings, "Preferências do aplicativo.");
        var content = new StackPanel { HorizontalAlignment = HorizontalAlignment.Left };
        content.SetResourceReference(FrameworkElement.MaxWidthProperty, "SettingsMaxWidth");
        content.SetBinding(FrameworkElement.WidthProperty, new Binding("ActualWidth") { Source = PageContent });
        content.Children.Add(Ui.Section("Geral"));
        var startup = Ui.Switch("", _startup.IsEnabled(), enabled => Execute(() => SetStartup(enabled)));
        System.Windows.Automation.AutomationProperties.SetName(startup, "Iniciar com o Windows");
        startup.IsEnabled = !IsDevelopment;
        if (IsDevelopment) startup.ToolTip = "Disponível na versão instalada do Organiza.";
        var confirm = Ui.Switch("", _state!["settings"].B("confirmRemoval"), enabled => Execute(() => SaveSetting(new SettingsPatch { ConfirmRemoval = enabled })));
        System.Windows.Automation.AutomationProperties.SetName(confirm, "Confirmar remoção de pastas");
        var general = Ui.Card(Ui.Stack(
            SettingsRow(AppIcon.Power, "Iniciar com o Windows", "Iniciar na bandeja ao entrar no Windows.", startup), Ui.Divider(),
            SettingsRow(AppIcon.Shield, "Confirmar remoção de pastas", "Pedir confirmação antes de remover um cadastro.", confirm)));
        general.Padding = new Thickness(0);
        content.Children.Add(general);
        content.Children.Add(Ui.Section("Dados locais"));
        var openProfile = IconAction(AppIcon.Folder, "Abrir configurações e histórico", () =>
        {
            var path = Client.ProfileDirectory ?? throw new InvalidOperationException("A pasta de dados não está disponível.");
            _shell.Open(path);
            return Task.CompletedTask;
        });
        openProfile.IsEnabled = Client.ProfileDirectory is not null;
        var local = Ui.Card(SettingsRow(AppIcon.Folder, "Configurações e histórico", "Armazenados neste computador.", openProfile));
        local.Padding = new Thickness(0);
        content.Children.Add(local);
        content.Children.Add(Ui.Section("Sobre"));
        var logo = new Image { Source = new BitmapImage(new Uri("pack://application:,,,/Assets/Organiza.ico")), Width = 36, Height = 36, Margin = new Thickness(0, 0, 18, 0) };
        var copyright = typeof(App).Assembly.GetCustomAttribute<AssemblyCopyrightAttribute>()?.Copyright
            ?? throw new InvalidOperationException("O executável não contém a identificação de autoria.");
        var name = Ui.Stack(
            Ui.Text("Organiza", TextRole.Label, bold: true),
            Ui.Text("Versão " + _state.S("appVersion"), TextRole.Caption, true),
            Ui.Text(copyright, TextRole.Caption, true),
            Ui.Text("Licença proprietária", TextRole.Caption, true));
        var about = Ui.Toolbar(Ui.Inline(logo, name), Ui.Link("Informações e diagnóstico", () => Execute(ShowAboutDetails)));
        about.Margin = DesignResources.Spacing("SettingsRowPadding");
        var panel = Ui.Card(about);
        panel.Padding = new Thickness(0);
        content.Children.Add(panel);
        PageContent.Children.Add(content);
        _pageStatus = "Alterações salvas automaticamente";
    }

    private static Border SettingsRow(AppIcon icon, string title, string description, FrameworkElement action)
    {
        var glyph = Ui.Glyph(icon, large: true);
        glyph.Margin = new Thickness(0, 0, 22, 0);
        var subtitle = Ui.Text(description, TextRole.Caption, true);
        subtitle.Margin = new Thickness(0, 6, 0, 0);
        var row = Ui.Toolbar(Ui.IconContent(glyph, Ui.Stack(Ui.Text(title, TextRole.Label, bold: true), subtitle)), action);
        row.Margin = new Thickness(0);
        return new Border { Child = row, Padding = DesignResources.Spacing("SettingsRowPadding") };
    }

    private async Task SaveSetting(SettingsPatch patch)
    {
        Apply(await Client.UpdateSettings(patch));
        _notice = "Preferência salva.";
    }
    private Task SetStartup(bool enabled) => _startup.Save(enabled, () => SaveSetting(new SettingsPatch { LaunchAtLogin = enabled }));
}
