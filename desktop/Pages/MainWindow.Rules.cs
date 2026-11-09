using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private string _ruleQuery = "";

    private void RulesPage()
    {
        Header(AppPage.Rules, "Defina o destino de cada arquivo.");
        if (Folder is null)
        {
            EmptyFolders();
            return;
        }
        var picker = Ui.FolderChoice("Configurar pasta", Folders.Select(folder => (folder.S("id"), folder.S("name"))), _navigation.FolderId, integrated: true);
        picker.SelectionChanged += (_, _) => { _ruleQuery = ""; _navigation.SelectRulesFolder(Ui.Value(picker)); };
        var policy = LabeledAction(AppIcon.Shield, "Exceções e revisão", PolicyDialog);
        policy.Margin = DesignResources.Spacing("RulesPolicyMargin");
        policy.SetResourceReference(FrameworkElement.HeightProperty, "ChoiceHeight");
        var left = Ui.Inline(picker, policy);
        var search = Ui.Search(_ruleQuery, "Buscar regras", compact: true);
        search.Tag = "Buscar regras";
        search.Margin = DesignResources.Spacing("RulesSearchMargin");
        var add = LabeledAction(AppIcon.Add, "Nova regra", () => RuleDialog(null), true);
        add.Margin = new Thickness(0);
        var toolbar = Ui.Toolbar(left, add);
        toolbar.Margin = new Thickness(0);
        PageContent.Children.Add(toolbar);
        PageContent.Children.Add(search);
        var host = new ContentControl { HorizontalContentAlignment = HorizontalAlignment.Stretch };
        PageContent.Children.Add(host);
        void Draw()
        {
            var matches = Folder!["organization"].Items("rules").Where(rule =>
                (rule.S("name") + " " + Conditions(rule, false) + " " + rule["destination"].S("value")).Contains(_ruleQuery, StringComparison.OrdinalIgnoreCase)).ToList();
            host.Content = matches.Count == 0 ? Ui.Text("Nenhuma regra encontrada. Crie uma regra ou use categorias sugeridas.", TextRole.Caption, true) : Ui.Cards(matches.Select(RuleCard));
        }
        search.TextChanged += (_, _) => { _ruleQuery = search.Text; Draw(); };
        Draw();
        PageContent.Children.Add(Ui.Link("+ Usar categorias sugeridas", () => Execute(async () => Apply(await Client.AddPresetRules(_navigation.FolderId)))));
        if (_navigation.CanReturnToFolder)
            PageContent.Children.Add(Ui.Link("← Voltar à pasta", () => OpenFolder(Folder!)));
        var rules = Folder["organization"].Items("rules").ToList();
        _pageStatus = FilePresentation.Quantity(rules.Count, "regra", "regras") + $" · {rules.Count(rule => rule.B("enabled"))} ativas";
    }

    private Border RuleCard(JsonNode rule)
    {
        var conditions = rule.Items("conditions").ToList();
        var type = conditions.FirstOrDefault(condition => condition.S("field") == "type").S("value");
        var icon = Ui.Glyph(FilePresentation.TypeIcon(type), large: true);
        icon.Margin = new Thickness(0, 0, 16, 0);
        var summary = Ui.Ellipsis(Conditions(rule), TextRole.Caption, true);
        summary.ToolTip = Conditions(rule, false);
        summary.Margin = new Thickness(0, 6, 0, 0);
        var identity = Ui.IconContent(icon, Ui.Stack(Ui.Ellipsis(rule.S("name"), TextRole.Label, bold: true), summary));
        var toggle = Ui.Switch(rule.B("enabled") ? "Ativa" : "Pausada", rule.B("enabled"), _ => Execute(async () => Apply(await Client.ToggleRule(_navigation.FolderId, rule.S("id")))));
        System.Windows.Automation.AutomationProperties.SetName(toggle, "Ativar regra " + rule.S("name"));
        toggle.SetResourceReference(Control.ForegroundProperty, StatusPresentation.BrushFor(rule.B("enabled") ? StatusTone.Automatic : StatusTone.Neutral));
        toggle.Margin = new Thickness(12, 0, 0, 0);
        var top = Ui.Toolbar(identity, toggle);
        top.Margin = new Thickness(0, 0, 0, 12);
        var target = Ui.Ellipsis(rule["destination"].S("value"), TextRole.Caption, true);
        var folder = Ui.Glyph(AppIcon.Folder);
        folder.Margin = new Thickness(0, 0, 12, 0);
        var actions = Ui.Inline(IconAction(AppIcon.Edit, "Editar " + rule.S("name"), () => RuleDialog(rule)),
            IconAction(AppIcon.Trash, "Remover " + rule.S("name"), async () =>
            {
                if (Dialog(new UiDialog(this, "Remover regra?", rule.S("name") + "\nOs arquivos existentes serão preservados.", "Remover", () => Task.CompletedTask, danger: true, integrated: true, headingIcon: AppIcon.Trash)))
                    Apply(await Client.RemoveRule(_navigation.FolderId, rule.S("id")));
            }));
        var bottom = Ui.Toolbar(Ui.IconContent(folder, target), actions);
        bottom.Margin = new Thickness(0, 6, 0, 0);
        var card = Ui.Card(Ui.Stack(top, Ui.Divider(), bottom));
        card.Padding = DesignResources.Spacing("RuleCardPadding");
        card.SetResourceReference(FrameworkElement.MinHeightProperty, "RuleCardHeight");
        return card;
    }

    private string Conditions(JsonNode rule, bool compact = true) => string.Join(rule.S("match") == "all" ? " · E · " : " · OU · ", rule.Items("conditions").Select(condition =>
    {
        var field = condition.S("field");
        if (field == "noExtension")
            return "Sem extensão";
        if (field == "type")
        {
            var extensions = (_state?["fileTypes"]?[condition.S("value")]).Items("extensions").Select(item => item.ToString()).ToList();
            return extensions.Count > 0 ? string.Join(", ", extensions.Take(compact ? 4 : extensions.Count)) + (compact && extensions.Count > 4 ? $" +{extensions.Count - 4}" : "") : FileTypes.FirstOrDefault(item => item.Item1 == condition.S("value")).Item2 ?? condition.S("value");
        }
        var value = condition["value"] is JsonArray values ? string.Join(", ", values.Select(item => item?.ToString())) : condition.S("value");
        return field == "extension" ? value : FieldNames.GetValueOrDefault(field, field) + ": " + value;
    }));
}
