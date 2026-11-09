using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private static string[] Lines(string value) => value.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    private Task PolicyDialog()
    {
        if (Folder is null)
            throw new InvalidOperationException("Adicione uma pasta primeiro.");
        var org = Folder["organization"]!;
        var ex = org["exclusions"];
        TextBox Multi(string key, string label)
        {
            var box = Ui.Input(string.Join(Environment.NewLine, ex.Items(key).Select(v => v.ToString())), label);
            box.AcceptsReturn = true;
            box.SetResourceReference(FrameworkElement.StyleProperty, "MultilineTextInput");
            box.VerticalScrollBarVisibility = ScrollBarVisibility.Auto;
            return box;
        }
        TextBox names = Multi("names", "Nomes ignorados"), extensions = Multi("extensions", "Extensões ignoradas"), subfolders = Multi("subfolders", "Subpastas ignoradas"), files = Multi("files", "Caminhos exatos ignorados");
        TextBox above = Ui.Input(org.S("reviewAboveMB", "500"), "Revisar acima de MB"), age = Ui.Input(org.S("minAgeSeconds", "90"), "Idade mínima em segundos");
        var unknown = new CheckBox { Content = "Revisar formatos desconhecidos", IsChecked = org.B("reviewUnknown"), Margin = new Thickness(0, 10, 0, 12) };
        var dialog = new UiDialog(this, "Exceções e revisão", "Um item por linha. Subpastas e arquivos exatos usam caminhos relativos à pasta cadastrada.", "Salvar", async () => Apply(await Client.SavePolicy(_navigation.FolderId,
            new
            {
                exclusions = new
                {
                    names = Lines(names.Text),
                    extensions = Lines(extensions.Text),
                    subfolders = Lines(subfolders.Text),
                    files = Lines(files.Text)
                },
                reviewAboveMB = ParseFormNumber(above.Text, "Limite de revisão"),
                minAgeSeconds = ParseFormNumber(age.Text, "Idade mínima"),
                reviewUnknown = unknown.IsChecked == true
            })), 680, integrated: _navigation.Page == AppPage.Rules, headingIcon: AppIcon.Shield);
        if (_navigation.Page == AppPage.Rules)
        {
            foreach (var input in new[] { names, extensions, subfolders, files, above, age })
            {
                input.Tag = "";
                input.SetResourceReference(FrameworkElement.StyleProperty, input.AcceptsReturn ? "MultilineTextInput" : "CompactTextInput");
            }
            unknown.Style = Ui.Style("ToggleSwitch");
        }
        dialog.Body.Children.Add(Ui.Section("Ignorar arquivos"));
        foreach (var (label, input) in new[] { ("Nomes que contenham", names), ("Extensões (ex.: .tmp)", extensions), ("Subpastas", subfolders), ("Caminhos exatos de arquivos", files), ("Pedir revisão acima de (MB)", above), ("Aguardar arquivos modificados recentemente (segundos)", age) })
        {
            if (input == above)
                dialog.Body.Children.Add(Ui.Section("Revisão e estabilidade"));
            dialog.Body.Children.Add(Ui.Field(label, input));
        }
        dialog.Body.Children.Add(unknown);
        Dialog(dialog);
        return Task.CompletedTask;
    }
}
