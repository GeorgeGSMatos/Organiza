using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private void FillFileDetails(StackPanel panel, PreviewItem? row)
    {
        panel.Children.Clear();
        if (row is null) return;

        var icon = Ui.Glyph(FilePresentation.TypeIcon(row.Source.S("type")), large: true);
        icon.Margin = DesignResources.Spacing("FileDetailIconMargin");
        var title = Ui.Text(row.Name, TextRole.Label, bold: true);
        title.ToolTip = row.Name;
        panel.Children.Add(Ui.IconContent(icon, title));
        var status = Ui.Status(FilePresentation.DescribeStatus(row.PresentationStatus));
        status.Margin = DesignResources.Spacing("FileDetailStatusMargin");
        panel.Children.Add(status);
        panel.Children.Add(Ui.Divider());

        var group = ReviewGroup(row);
        if (group is null)
        {
            var destination = Ui.Text(row.DestinationLabel, TextRole.Body);
            destination.ToolTip = row.Destination;
            var folder = Ui.Glyph(AppIcon.Folder);
            folder.Margin = DesignResources.Spacing("FileDetailIconMargin");
            panel.Children.Add(FileDetailSection("Destino", Ui.IconContent(folder, destination)));
            if (row.PresentationStatus != "ready" && !string.IsNullOrWhiteSpace(row.Reason))
                panel.Children.Add(FileDetailSection("Situação", Ui.Text(row.Reason, TextRole.Caption, muted: true)));
        }
        else
        {
            var suggestion = Ui.Stack(Ui.Text(group["suggestion"].S("name", "Escolha uma categoria"), TextRole.Body, bold: true));
            var reason = group["suggestion"].S("reason");
            if (!string.IsNullOrWhiteSpace(reason))
            {
                var description = Ui.Text(reason, TextRole.Caption, muted: true);
                description.Margin = DesignResources.Spacing("FileDetailValueMargin");
                suggestion.Children.Add(description);
            }
            panel.Children.Add(FileDetailSection("Sugestão", suggestion));
            panel.Children.Add(FileDetailAction("Criar categoria", () => ReviewDialog(group), primary: true));
            panel.Children.Add(FileDetailAction("Usar categoria", () => ReviewDialog(group, true)));
            panel.Children.Add(FileDetailAction("Manter onde está", () => KeepDialog(group)));
        }
        if (group is null && row.Source.Items("candidates").Count() > 1)
            panel.Children.Add(FileDetailAction("Resolver conflito", () => DecideRow(row)));

        var metadata = new Grid();
        metadata.ColumnDefinitions.Add(new ColumnDefinition());
        metadata.ColumnDefinitions.Add(new ColumnDefinition());
        var type = FileDetailValue("Tipo", row.Type);
        var size = FileDetailValue("Tamanho", row.Size);
        Grid.SetColumn(size, 1);
        metadata.Children.Add(type);
        metadata.Children.Add(size);
        panel.Children.Add(FileDetailSection("Informações", metadata));

        var paths = Ui.Stack(FileDetailValue("Origem", row.Source.S("path")), FileDetailValue("Destino completo", row.Destination));
        var details = new Expander { Header = "Caminhos completos", Content = paths };
        details.Margin = DesignResources.Spacing("FileDetailSectionMargin");
        panel.Children.Add(Ui.Divider());
        panel.Children.Add(details);
    }

    private static StackPanel FileDetailSection(string title, UIElement content)
    {
        var label = Ui.Text(title, TextRole.Caption, muted: true);
        label.Margin = DesignResources.Spacing("FileDetailLabelMargin");
        var section = Ui.Stack(label, content);
        section.Margin = DesignResources.Spacing("FileDetailSectionMargin");
        return section;
    }

    private static StackPanel FileDetailValue(string label, string value)
    {
        var caption = Ui.Text(label, TextRole.Caption, muted: true);
        var text = Ui.Text(value, TextRole.Caption);
        text.ToolTip = value;
        text.Margin = DesignResources.Spacing("FileDetailValueMargin");
        var field = Ui.Stack(caption, text);
        field.Margin = DesignResources.Spacing("FileDetailFieldMargin");
        return field;
    }

    private Button FileDetailAction(string label, Func<Task> action, bool primary = false)
    {
        var button = Action(label, action, primary);
        button.HorizontalAlignment = HorizontalAlignment.Stretch;
        button.Margin = DesignResources.Spacing("FileDetailActionMargin");
        return button;
    }
}
