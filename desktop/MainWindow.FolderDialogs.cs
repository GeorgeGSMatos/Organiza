using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;
using Organiza.Wpf.Services;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private Task EditFolder() => EditFolder(null);
    private Task EditFolder(JsonNode? folder)
    {
        var overviewStyle = _navigation.Page == AppPage.Overview;
        var path = Ui.Input(folder.S("path"), "Caminho da pasta");
        var name = Ui.Input(folder.S("name"), "Nome da pasta");
        if (overviewStyle)
        {
            foreach (var input in new[] { path, name })
            {
                input.SetResourceReference(FrameworkElement.WidthProperty, "FolderDialogInputWidth");
                input.SetResourceReference(FrameworkElement.StyleProperty, "CompactTextInput");
                input.HorizontalAlignment = HorizontalAlignment.Left;
                input.VerticalAlignment = VerticalAlignment.Top;
            }
            path.SetResourceReference(Control.BackgroundProperty, "ShadeSurfaceBrush");
            name.SetResourceReference(Control.BackgroundProperty, "ShadeSurfaceBrush");
        }
        var recursive = new CheckBox { Content = "Incluir subpastas", IsChecked = folder.B("includeSubfolders"), Margin = new Thickness(0, 10, 0, 12) };
        var dialog = new UiDialog(this, folder is null ? "Adicionar pasta" : "Editar pasta", "Escolha a pasta que deseja organizar.", "Salvar", async () =>
        {
            var previous = Folders.Select(f => f.S("id")).ToHashSet();
            Apply(await Client.SaveFolder(new FolderDraft(path.Text, name.Text, recursive.IsChecked == true), folder?.S("id")));
            if (folder is null && Folders.FirstOrDefault(f => !previous.Contains(f.S("id"))) is { } added)
                OpenFolder(added);
        }, integrated: overviewStyle, headingIcon: overviewStyle ? AppIcon.Folder : null);
        var pathField = Ui.Field("Caminho da pasta", path);
        if (overviewStyle)
            pathField.HorizontalAlignment = HorizontalAlignment.Left;
        dialog.Body.Children.Add(pathField);
        void ChooseFolder()
        {
            var selected = _shell.PickFolder(path.Text);
            if (selected.Length > 0)
                path.Text = selected;
        }
        dialog.Body.Children.Add(overviewStyle
            ? Ui.LabeledIcon(AppIcon.Folder, "Escolher pasta…", ChooseFolder)
            : Ui.Button("Escolher…", ChooseFolder));
        var nameField = Ui.Field("Nome no Organiza (opcional)", name);
        if (overviewStyle)
            nameField.HorizontalAlignment = HorizontalAlignment.Left;
        dialog.Body.Children.Add(nameField);
        dialog.Body.Children.Add(recursive);
        Dialog(dialog);
        return Task.CompletedTask;
    }
    private async Task RemoveFolder(JsonNode folder)
    {
        var approved = !_state!["settings"].B("confirmRemoval") || Dialog(new UiDialog(this, "Remover pasta do Organiza?", folder.S("name") + "\nOs arquivos permanecem onde estão. O cadastro e suas regras serão removidos.", "Remover cadastro", () => Task.CompletedTask, danger: true));
        if (approved)
            Apply(await Client.RemoveFolder(folder.S("id")));
    }
}
