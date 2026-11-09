using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private static readonly Dictionary<string, string> FieldNames = new()
    {
        ["extension"] = "Extensão",
        ["type"] = "Tipo de arquivo",
        ["nameContains"] = "Nome contém",
        ["nameStarts"] = "Nome começa com",
        ["nameEnds"] = "Nome termina com",
        ["sizeMin"] = "Tamanho mínimo (MB)",
        ["sizeMax"] = "Tamanho máximo (MB)",
        ["modifiedBefore"] = "Modificado até",
        ["modifiedAfter"] = "Modificado a partir de",
        ["noExtension"] = "Sem extensão"
    };
    private static readonly (string, string)[] FileTypes = [("document", "Documento"), ("spreadsheet", "Planilha"), ("image", "Imagem"), ("video", "Vídeo"), ("audio", "Áudio"), ("archive", "Compactado"), ("installer", "Instalador"), ("other", "Outro")];
    private sealed class ConditionEditor
    {
        public StackPanel Panel { get; } = new();
        public ComboBox Field
        {
            get;
        }
        private FrameworkElement _input = new TextBox();
        private readonly TextBlock _hint = Ui.Text("", TextRole.Caption, muted: true);
        public ConditionEditor(JsonNode condition, Action remove, bool integrated = false)
        {
            Field = Ui.Choice("Tipo de condição", FieldNames.Select(k => (k.Key, k.Value)), condition.S("field", "extension"));
            if (integrated)
            {
                Field.SetResourceReference(FrameworkElement.StyleProperty, "CompactChoice");
                Ui.IntegrateDropdown(Field);
            }
            var removeButton = Ui.Icon(AppIcon.Trash, "Remover condição", remove);
            removeButton.Margin = new Thickness(0);
            var header = Ui.Toolbar(Field, removeButton);
            header.Margin = new Thickness(0);
            Panel.Children.Add(header);
            void Draw(JsonNode? original)
            {
                if (Panel.Children.Contains(_input))
                    Panel.Children.Remove(_input);
                var field = Ui.Value(Field);
                if (field == "type")
                    _input = Ui.Choice("Tipo de arquivo", FileTypes, original.S("value", "document"));
                else if (field == "noExtension")
                    _input = Ui.Text("Corresponde a arquivos sem extensão.", TextRole.Caption, true);
                else
                    _input = Ui.Input(original?["value"] is JsonArray values ? string.Join(", ", values.Select(v => v?.ToString())) : original.S("value"), "Valor da condição");
                if (integrated && _input is ComboBox dropdown)
                {
                    dropdown.SetResourceReference(FrameworkElement.StyleProperty, "CompactChoice");
                    Ui.IntegrateDropdown(dropdown);
                }
                if (integrated && _input is TextBox input)
                    input.SetResourceReference(FrameworkElement.StyleProperty, "CompactTextInput");
                _hint.Text = field switch
                {
                    "extension" => "Separe as extensões por vírgula. Ex.: .pdf, .docx",
                    "nameContains" => "Digite uma parte do nome. Ex.: relatório",
                    "sizeMin" or "sizeMax" => "Informe o tamanho em MB. Ex.: 10",
                    "modifiedBefore" or "modifiedAfter" => "Informe a data no formato AAAA-MM-DD. Ex.: 2026-11-02",
                    "type" => "Escolha o tipo de arquivo que esta condição deve identificar.",
                    "noExtension" => "Não é necessário preencher um valor.",
                    _ => "Informe o valor que o arquivo deve atender."
                };
                Panel.Children.Insert(1, _input);
            }
            Field.SelectionChanged += (_, _) => Draw(null);
            Draw(condition);
            _hint.Margin = DesignResources.Spacing("RuleHintMargin");
            Panel.Children.Add(_hint);
        }
        public object Value()
        {
            var field = Ui.Value(Field);
            object value = field == "noExtension" ? true : _input is ComboBox choice ? Ui.Value(choice) : ((TextBox)_input).Text;
            if (field is "sizeMin" or "sizeMax")
                value = ParseFormNumber(value.ToString()!, "Tamanho");
            return new
            {
                field,
                value
            };
        }
    }
}
