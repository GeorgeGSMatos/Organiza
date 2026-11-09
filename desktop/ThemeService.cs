using System.Diagnostics;
using Microsoft.Win32;
using System.Windows;
using System.Windows.Media;
using SystemColors = System.Windows.SystemColors;

namespace Organiza.Wpf;

public sealed class ThemeService : IDisposable
{
    private bool _subscribed;
    public bool IsDark => DetectDarkTheme();
    public event EventHandler? ThemeChanged;

    public void Start()
    {
        if (_subscribed)
            return;
        try
        {
            SystemEvents.UserPreferenceChanged += OnUserPreferenceChanged;
            _subscribed = true;
        }
        catch (Exception error)
        {
            Trace.TraceWarning("System theme notifications unavailable: {0}", error.Message);
        }
    }

    public void Apply(System.Windows.Application application, bool? darkMode = null)
    {
        var dark = darkMode ?? IsDark;
        foreach (var role in new[] { "Background", "Surface", "SolidSurface", "SurfaceHover", "Text", "MutedText", "Border", "Track", "Navigation", "QuickTint", "Error", "Danger", "Manual", "AccentText", "Success", "Warning", "Selection", "InteractionOutline", "InteractionFill", "CardHoverOutline" })
            application.Resources[$"Shade{role}Brush"] = Brush(Palette(application, dark, role));
        application.Resources["ShadeAccentBrush"] = Brush(Palette(application, dark, "Accent"));
        if (SystemParameters.HighContrast)
        {
            foreach (var name in new[] { "ShadeBackgroundBrush", "ShadeSurfaceBrush", "ShadeSolidSurfaceBrush", "ShadeNavigationBrush", "ShadeQuickTintBrush" })
                application.Resources[name] = SystemColors.WindowBrush;
            foreach (var name in new[] { "ShadeTextBrush", "ShadeMutedTextBrush", "ShadeBorderBrush", "ShadeTrackBrush", "ShadeErrorBrush", "ShadeDangerBrush", "ShadeManualBrush", "ShadeSuccessBrush", "ShadeWarningBrush", "ShadeInteractionOutlineBrush", "ShadeCardHoverOutlineBrush" })
                application.Resources[name] = SystemColors.WindowTextBrush;
            application.Resources["ShadeAccentBrush"] = SystemColors.HighlightBrush;
            application.Resources["ShadeAccentTextBrush"] = SystemColors.HighlightTextBrush;
            application.Resources["ShadeSelectionBrush"] = SystemColors.HighlightBrush;
            application.Resources["ShadeInteractionFillBrush"] = SystemColors.HighlightBrush;
        }
    }

    public static bool DetectDarkTheme()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return (key?.GetValue("AppsUseLightTheme") as int? ?? 1) == 0;
        }
        catch (Exception error)
        {
            Trace.TraceWarning("Cannot read system theme; using the light-theme fallback: {0}", error.Message);
            return false;
        }
    }

    private void OnUserPreferenceChanged(object? sender, UserPreferenceChangedEventArgs e) => ThemeChanged?.Invoke(this, EventArgs.Empty);
    private static Color Palette(Application application, bool dark, string role) =>
        (Color)application.FindResource($"{(dark ? "Dark" : "Light")}{role}Color");

    private static SolidColorBrush Brush(Color color)
    {
        var brush = new SolidColorBrush(color);
        brush.Freeze();
        return brush;
    }

    public void Dispose()
    {
        if (!_subscribed)
            return;
        SystemEvents.UserPreferenceChanged -= OnUserPreferenceChanged;
        _subscribed = false;
    }
}
