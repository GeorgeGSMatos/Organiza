using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private Task RuleDialog(JsonNode? rule)
    {
        if (Folder is null)
            throw new InvalidOperationException("Adicione uma pasta primeiro.");
        var integrated = _navigation.Page == AppPage.Rules;
        var name = Ui.Input(rule.S("name"), "Nome da regra");
        name.MaxLength = 80;
        var enabled = new CheckBox { Content = "Regra ativa", IsChecked = rule.B("enabled", true), Margin = new Thickness(0, 8, 0, 12) };
        var match = Ui.Choice("Combinar condições", [("all", "Todas as condições (E)"), ("any", "Qualquer condição (OU)")], rule.S("match", "all"));
        var action = Ui.Choice("Ação da regra", [("move", "Organizar"), ("suggest", "Somente sugerir")], rule.S("action", "move"));
        var scope = Ui.Choice("Escopo da regra", [("inherit", "Seguir configuração da pasta"), ("root", "Somente a pasta principal")], rule.S("scope", "inherit"));
        var destination = Ui.Input(rule?["destination"].S("value") ?? "", "Caminho de destino");
        var mode = Ui.Choice("Tipo de destino", [("relative", "Subpasta da origem"), ("absolute", "Caminho completo")], rule?["destination"].S("mode", "relative") ?? "relative");
        if (integrated)
        {
            name.Tag = "";
            destination.Tag = "";
            name.SetResourceReference(FrameworkElement.StyleProperty, "CompactTextInput");
            destination.SetResourceReference(FrameworkElement.StyleProperty, "CompactTextInput");
            enabled.Style = Ui.Style("ToggleSwitch");
            foreach (var choice in new[] { match, action, scope, mode })
            {
                choice.SetResourceReference(FrameworkElement.StyleProperty, "CompactChoice");
                Ui.IntegrateDropdown(choice);
            }
        }
        var rows = new List<ConditionEditor>();
        var conditions = new StackPanel();
        void Add(JsonNode condition)
        {
            ConditionEditor? row = null;
            row = new ConditionEditor(condition, () => { rows.Remove(row!); conditions.Children.Remove(row!.Panel); }, integrated);
            rows.Add(row);
            conditions.Children.Add(row.Panel);
        }
        // Keep the exact panel wrapper when removing a condition.
        void Redraw()
        {
            conditions.Children.Clear();
            foreach (var row in rows)
                conditions.Children.Add(row.Panel);
        }
        var defaults = rule.Items("conditions").ToList();
        if (defaults.Count == 0)
            defaults.Add(JsonNode.Parse("{\"field\":\"extension\",\"value\":[]}")!);
        foreach (var condition in defaults)
            Add(condition);
        Redraw();
        var dialog = new UiDialog(this, rule is null ? "Nova regra" : "Editar regra", "Defina as condições e o destino. Os arquivos só serão movidos depois da confirmação.", "Salvar", async () =>
        {
            var target = destination.Text.Length == 0 && Ui.Value(mode) == "relative" ? name.Text : destination.Text;
            Apply(await Client.SaveRule(_navigation.FolderId, new
            {
                name = name.Text,
                enabled = enabled.IsChecked == true,
                match = Ui.Value(match),
                action = Ui.Value(action),
                scope = Ui.Value(scope),
                conditions = rows.Select(r => r.Value()).ToArray(),
                destination = new
                {
                    mode = Ui.Value(mode),
                    value = target
                },
                presetId = rule?["presetId"]?.DeepClone()
            }, rule?.S("id")));
        }, 680, integrated: integrated, headingIcon: integrated ? AppIcon.Rules : null);
        dialog.Body.Children.Add(Ui.Field("Nome da regra", name));
        var nameHelp = Ui.Text("Use um nome fácil de reconhecer. Ex.: Documentos de trabalho", TextRole.Caption, muted: true);
        nameHelp.Margin = DesignResources.Spacing("RuleHintMargin");
        dialog.Body.Children.Add(nameHelp);
        dialog.Body.Children.Add(enabled);
        dialog.Body.Children.Add(Ui.Section("Condições"));
        dialog.Body.Children.Add(Ui.Field("Aplicar quando", match));
        dialog.Body.Children.Add(conditions);
        dialog.Body.Children.Add(Ui.LabeledIcon(AppIcon.Add, "Adicionar condição", () => { Add(JsonNode.Parse("{\"field\":\"nameContains\",\"value\":\"\"}")!); Redraw(); }));
        dialog.Body.Children.Add(Ui.Section("Destino"));
        dialog.Body.Children.Add(mode);
        dialog.Body.Children.Add(destination);
        var destinationHelp = Ui.Text("", TextRole.Caption, muted: true);
        destinationHelp.Margin = DesignResources.Spacing("RuleHintMargin");
        void ExplainDestination()
        {
            destinationHelp.Text = Ui.Value(mode) == "relative"
                ? "Informe uma subpasta da origem. Ex.: Documentos. Se deixar vazio, será usado o nome da regra."
                : "Informe o caminho completo ou use Escolher pasta. Ex.: C:\\Arquivos\\Documentos";
        }
        mode.SelectionChanged += (_, _) => ExplainDestination();
        ExplainDestination();
        dialog.Body.Children.Add(destinationHelp);
        dialog.Body.Children.Add(Ui.LabeledIcon(AppIcon.Folder, "Escolher pasta…", () => { var selected = _shell.PickFolder(destination.Text); if (selected.Length > 0) { mode.SelectedValue = "absolute"; destination.Text = selected; } }));
        var advanced = Ui.Stack(Ui.Field("Ação", action), Ui.Field("Escopo", scope));
        dialog.Body.Children.Add(new Expander
        {
            Header = "Opções avançadas",
            Content = advanced,
            IsExpanded = Ui.Value(action) != "move" || Ui.Value(scope) != "inherit",
            Margin = DesignResources.Spacing("RuleAdvancedMargin")
        });
        Dialog(dialog);
        return Task.CompletedTask;
    }
}
