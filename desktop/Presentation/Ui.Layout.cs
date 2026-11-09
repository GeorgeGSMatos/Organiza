using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using Organiza.Wpf.Presentation.Controls;

namespace Organiza.Wpf.Presentation;

public sealed record FilterOption(string Id, string Label, int? Count = null);

public static partial class Ui
{
    public static StackPanel Inline(params UIElement[] children)
    {
        var panel = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
        foreach (var child in children)
        {
            if (child is FrameworkElement element && element.ReadLocalValue(FrameworkElement.VerticalAlignmentProperty) == DependencyProperty.UnsetValue)
                element.VerticalAlignment = VerticalAlignment.Center;
            panel.Children.Add(child);
        }
        return panel;
    }

    public static Grid IconContent(UIElement icon, UIElement content)
    {
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        if (content is FrameworkElement element)
            element.VerticalAlignment = VerticalAlignment.Center;
        Grid.SetColumn(content, 1);
        grid.Children.Add(icon);
        grid.Children.Add(content);
        return grid;
    }

    public static Button LabeledIcon(AppIcon icon, string label, Action action, bool primary = false)
    {
        var button = Button(label, action, primary);
        var glyph = Glyph(icon);
        glyph.Margin = new Thickness(0, 0, 10, 0);
        button.Content = Inline(glyph, new TextBlock { Text = label, VerticalAlignment = VerticalAlignment.Center });
        return button;
    }

    public static Button Link(string label, Action action)
    {
        var button = Button(label, action);
        button.Style = Style("LinkButton");
        return button;
    }

    public static TextBlock Ellipsis(string text, TextRole role = TextRole.Body, bool muted = false, bool bold = false)
    {
        var block = Text(text, role, muted, bold);
        block.TextWrapping = TextWrapping.NoWrap;
        block.TextTrimming = TextTrimming.CharacterEllipsis;
        block.ToolTip = text;
        return block;
    }

    public static Grid Toolbar(UIElement left, UIElement right)
    {
        var grid = new Grid { Margin = DesignResources.Spacing("ToolbarMargin") };
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        Grid.SetColumn(right, 1);
        grid.Children.Add(left);
        grid.Children.Add(right);
        return grid;
    }

    public static Border Divider() => new() { Height = 1, Style = Style("Divider") };

    public static WrapPanel Tabs(IEnumerable<FilterOption> options, string selected, Action<string> changed)
    {
        var panel = new WrapPanel();
        foreach (var option in options)
        {
            var label = Text(option.Label);
            label.ClearValue(TextBlock.ForegroundProperty);
            var content = Inline(label);
            if (option.Count is { } count)
            {
                var counter = new Border { Child = Text(count.ToString(), TextRole.Caption), CornerRadius = new CornerRadius(7), Padding = new Thickness(5, 0, 5, 0), Margin = new Thickness(8, 0, 0, 0) };
                counter.SetResourceReference(Border.BackgroundProperty, "ShadeSurfaceBrush");
                content.Children.Add(counter);
            }
            var tab = new FilterTab { Content = content, IsActive = selected == option.Id, Tag = option.Id };
            AutomationProperties.SetName(tab, option.Label + (option.Count is { } total ? $" · {total}" : ""));
            tab.Click += (_, _) => changed(option.Id);
            panel.Children.Add(tab);
        }
        return panel;
    }

    public static ComboBox FolderChoice(string label, IEnumerable<(string Id, string Name)> options, string selected, bool integrated = false)
    {
        var choice = Choice(label, options, selected);
        choice.DisplayMemberPath = "";
        choice.ItemTemplate = (DataTemplate)Application.Current.FindResource("FolderChoiceItem");
        choice.SetResourceReference(FrameworkElement.WidthProperty, "FolderSelectorWidth");
        choice.HorizontalAlignment = HorizontalAlignment.Left;
        choice.Margin = new Thickness(0);
        if (integrated)
            IntegrateDropdown(choice);
        return choice;
    }

    public static StackPanel Status(StatusPresentation status) => Status(status.Icon, status.Label, status.BrushKey);

    public static StackPanel Status(AppIcon icon, string label, string? brush = null)
    {
        var glyph = Glyph(icon);
        glyph.Margin = new Thickness(0, 0, 9, 0);
        var text = Text(label, TextRole.Caption);
        var line = Inline(glyph, text);
        if (brush is not null)
        {
            glyph.SetResourceReference(TextBlock.ForegroundProperty, brush);
            text.SetResourceReference(TextBlock.ForegroundProperty, brush);
        }
        return line;
    }

    public static Grid TableRow(IReadOnlyList<GridLength> widths, params UIElement[] cells)
    {
        if (widths.Count != cells.Length)
            throw new ArgumentException("A quantidade de células deve corresponder às colunas.", nameof(cells));
        var grid = new Grid();
        for (var index = 0; index < cells.Length; index++)
        {
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = widths[index] });
            Grid.SetColumn(cells[index], index);
            grid.Children.Add(cells[index]);
            if (cells[index] is FrameworkElement cell)
            {
                cell.VerticalAlignment = VerticalAlignment.Center;
                cell.Margin = new Thickness(0, 0, index == cells.Length - 1 ? 0 : 12, 0);
            }
        }
        return grid;
    }
}
