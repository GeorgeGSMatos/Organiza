using System.Windows;

namespace Organiza.Wpf.Presentation;

public enum TextRole
{
    Body, Caption, Label, Subheading, Section, DialogTitle, PageTitle
}

/// <summary>Named access to shared XAML tokens. Values stay in Styles, not in page builders.</summary>
public static class DesignResources
{
    public static double Number(string key) => (double)Application.Current.FindResource(key);
    public static Thickness Spacing(string key) => (Thickness)Application.Current.FindResource(key);
    public static string FontKey(TextRole role) => role switch
    {
        TextRole.Body => "FontBody",
        TextRole.Caption => "FontCaption",
        TextRole.Label => "FontLabel",
        TextRole.Subheading => "FontSubheading",
        TextRole.Section => "FontSection",
        TextRole.DialogTitle => "FontDialogTitle",
        TextRole.PageTitle => "FontPageTitle",
        _ => throw new ArgumentOutOfRangeException(nameof(role))
    };
}
