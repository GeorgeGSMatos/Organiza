using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using Organiza.Wpf.Presentation.Controls;

namespace Organiza.Wpf.Presentation;

public static partial class Ui
{
    public static Style Style(string key) => (Style)Application.Current.FindResource(key);
    public static TextBlock Text(string text, TextRole role = TextRole.Body, bool muted = false, bool bold = false)
    {
        var block = new TextBlock { Text = text, TextWrapping = TextWrapping.Wrap, FontWeight = bold ? FontWeights.SemiBold : FontWeights.Normal };
        block.SetResourceReference(TextBlock.FontSizeProperty, DesignResources.FontKey(role));
        block.SetResourceReference(TextBlock.ForegroundProperty, muted ? "ShadeMutedTextBrush" : "ShadeTextBrush");
        return block;
    }
    public static Button Button(string label, Action action, bool primary = false, bool danger = false)
    {
        var button = new Button { Content = label, Style = Style(primary ? "PrimaryButton" : danger ? "DangerButton" : "SecondaryButton"), Margin = DesignResources.Spacing("ActionMargin"), HorizontalAlignment = HorizontalAlignment.Left };
        AutomationProperties.SetName(button, label);
        button.Click += (_, _) => action();
        return button;
    }
    public static Button Icon(AppIcon icon, string label, Action action)
    {
        var button = Button(label, action);
        button.Style = Style(icon == AppIcon.Trash ? "DangerIconButton" : "IconButton");
        button.Content = new TextBlock { Text = AppIcons.Glyph(icon), Style = Style("FluentIcon") };
        button.ToolTip = label;
        return button;
    }
    public static WrapPanel Actions(params UIElement[] elements)
    {
        var panel = new WrapPanel { Margin = DesignResources.Spacing("ActionsMargin") };
        foreach (var e in elements)
            panel.Children.Add(e);
        return panel;
    }
    public static StackPanel Stack(params UIElement[] elements)
    {
        var panel = new StackPanel();
        foreach (var e in elements)
            panel.Children.Add(e);
        return panel;
    }
    public static Border Card(UIElement child) => new() { Style = Style("Card"), Child = child, Margin = DesignResources.Spacing("CardMargin") };
    public static TextBox Input(string text, string label)
    {
        var input = new TextBox { Text = text, Tag = label, Margin = DesignResources.Spacing("InputMargin") };
        AutomationProperties.SetName(input, label);
        return input;
    }
    public static CheckBox Switch(string label, bool value, Action<bool> changed)
    {
        var control = new CheckBox { Content = label, IsChecked = value, Style = Style("ToggleSwitch"), Margin = DesignResources.Spacing("SwitchMargin") };
        AutomationProperties.SetName(control, label);
        control.Checked += (_, _) => changed(true);
        control.Unchecked += (_, _) => changed(false);
        return control;
    }
    public static ComboBox Choice(string label, IEnumerable<(string Id, string Name)> options, string selected)
    {
        var control = new ComboBox { ItemsSource = options.Select(o => new ChoiceItem(o.Id, o.Name)).ToList(), DisplayMemberPath = "Name", SelectedValuePath = "Id", SelectedValue = selected, MinWidth = DesignResources.Number("ChoiceMinWidth"), Margin = DesignResources.Spacing("ChoiceMargin") };
        AutomationProperties.SetName(control, label);
        return control;
    }
    public static SearchField Search(string text, string label, bool compact = false)
    {
        var search = new SearchField { Text = text, Margin = DesignResources.Spacing("InputMargin") };
        AutomationProperties.SetName(search, label);
        if (compact)
            search.SetResourceReference(FrameworkElement.StyleProperty, "CompactSearchField");
        return search;
    }
    public static ResponsiveCardPanel Cards(IEnumerable<FrameworkElement> items)
    {
        var panel = new ResponsiveCardPanel();
        foreach (var item in items)
            panel.Children.Add(item);
        return panel;
    }
    public static TextBlock Glyph(AppIcon icon, bool large = false)
    {
        var glyph = new TextBlock { Text = AppIcons.Glyph(icon), Style = Style("FluentIcon") };
        if (large)
            glyph.SetResourceReference(TextBlock.FontSizeProperty, "IconLargeSize");
        return glyph;
    }
    public record ChoiceItem(string Id, string Name);
    public static string Value(ComboBox combo) => combo.SelectedValue?.ToString() ?? "";
    public static FrameworkElement Field(string label, UIElement control) => Stack(Text(label), control);
    public static TextBlock Section(string text)
    {
        var title = Text(text, TextRole.Section, bold: true);
        title.Margin = DesignResources.Spacing("SectionMargin");
        return title;
    }
}
