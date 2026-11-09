using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private List<(string Id, CheckBox Check)> FileChoices(UiDialog dialog, IEnumerable<JsonNode> files)
    {
        var choices = new List<(string, CheckBox)>();
        foreach (var file in files)
        {
            var caption = file.S("name") + " — " + file.S("relativePath");
            var check = new CheckBox { Content = Ui.Text(caption), IsChecked = true, Margin = new Thickness(0, 6, 0, 6) };
            System.Windows.Automation.AutomationProperties.SetName(check, caption);
            dialog.Body.Children.Add(check);
            choices.Add((file.S("id"), check));
        }
        return choices;
    }
    private Task ReviewDialog(JsonNode group, bool existing = false)
    {
        if (_preview is null)
            throw new InvalidOperationException("Analise novamente os arquivos.");
        var previewId = _preview.S("id");
        var folderId = group.S("folderId");
        var categories = (_preview["review"]?["categories"]?[folderId] as JsonArray)?.OfType<JsonNode>().ToList() ?? [];
        var mode = Ui.Choice("Como organizar", [("new", "Criar categoria"), ("existing", "Usar categoria existente")], existing ? "existing" : "new");
        var category = Ui.Choice("Categoria existente", categories.Select(c => (c.S("id"), c.S("name"))), group.S("recommendedCategoryId", categories.FirstOrDefault().S("id")));
        var name = Ui.Input(group["suggestion"].S("name"), "Nome da categoria");
        var destination = Ui.Input(name.Text, "Caminho de destino");
        var targetMode = Ui.Choice("Tipo de destino", [("relative", "Subpasta da origem"), ("absolute", "Caminho completo")], "relative");
        var future = new CheckBox { Content = "Criar regra também para os próximos arquivos", IsChecked = false, Margin = new Thickness(0, 12, 0, 12) };
        if (group.B("mixed"))
        {
            future.IsEnabled = false;
            future.ToolTip = "Para criar uma regra futura, selecione um formato por vez.";
        }
        List<(string Id, CheckBox Check)> choices = [];
        var dialog = new UiDialog(this, "Definir categoria", group.S("folderName") + " · " + group.S("extension", "Sem extensão") + "\nOs arquivos só serão movidos ao confirmar Organizar.", "Aplicar à seleção", async () =>
        {
            var response = await Client.Assign(previewId, choices.Where(c => c.Check.IsChecked == true).Select(c => c.Id).ToArray(), new
            {
                mode = Ui.Value(mode),
                categoryId = Ui.Value(category),
                name = name.Text,
                destination = new
                {
                    mode = Ui.Value(targetMode),
                    value = destination.Text.Length == 0 ? name.Text : destination.Text
                },
                saveForFuture = future.IsChecked == true
            });
            ApplyReview(response);
        }, 680);
        choices = FileChoices(dialog, group.Items("files"));
        dialog.Body.Children.Add(Ui.Field("Como organizar?", mode));
        var oldFields = Ui.Field("Categoria existente", category);
        var newFields = Ui.Stack(Ui.Field("Nome da nova categoria", name), Ui.Field("Tipo de destino", targetMode), Ui.Field("Caminho de destino", destination), Ui.Button("Escolher destino…", () => { var selected = _shell.PickFolder(); if (selected.Length > 0) { targetMode.SelectedValue = "absolute"; destination.Text = selected; } }));
        void Sync()
        {
            oldFields.Visibility = Ui.Value(mode) == "existing" ? Visibility.Visible : Visibility.Collapsed;
            newFields.Visibility = Ui.Value(mode) == "new" ? Visibility.Visible : Visibility.Collapsed;
        }
        mode.SelectionChanged += (_, _) => Sync();
        Sync();
        dialog.Body.Children.Add(oldFields);
        dialog.Body.Children.Add(newFields);
        dialog.Body.Children.Add(future);
        dialog.Body.Children.Add(new Expander { Header = "Como funciona esta decisão?", Content = Ui.Text("Sem regra futura, o destino vale apenas para a seleção. Uma categoria nova fica com a regra pausada.", TextRole.Caption, true) });
        Dialog(dialog);
        return Task.CompletedTask;
    }
    private Task KeepDialog(JsonNode group)
    {
        var mode = Ui.Choice("Como manter", [("defer", "Deixar para depois nesta sessão"), ("keep", "Não sugerir novamente estes caminhos")], "defer");
        List<(string Id, CheckBox Check)> choices = [];
        var dialog = new UiDialog(this, "Manter os arquivos onde estão", "A opção permanente cria exceções de caminho exato, editáveis em Exceções e revisão.", "Aplicar à seleção", async () =>
        {
            var response = await (Ui.Value(mode) == "keep" ? Client.Keep(_preview!.S("id"), choices.Where(c => c.Check.IsChecked == true).Select(c => c.Id).ToArray()) : Client.Defer(_preview!.S("id"), choices.Where(c => c.Check.IsChecked == true).Select(c => c.Id).ToArray()));
            ApplyReview(response);
        });
        choices = FileChoices(dialog, group.Items("files"));
        dialog.Body.Children.Add(mode);
        Dialog(dialog);
        return Task.CompletedTask;
    }
}
