using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Shell;
using Microsoft.Win32;

namespace Organiza.Wpf;

/// <summary>Native backdrops and alpha surfaces, with explicit readable fallbacks.</summary>
public static class Material
{
    private const int ImmersiveDarkModeAttribute = 20;
    private const int SystemBackdropAttribute = 38;
    private const string PersonalizationKey = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";

    private enum BackdropKind
    {
        Mica = 2, Acrylic = 3
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Margins
    {
        public int Left, Right, Top, Bottom;
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(nint window, int attribute, ref int value, int size);

    [DllImport("dwmapi.dll")]
    private static extern int DwmExtendFrameIntoClientArea(nint window, ref Margins margins);

    public static readonly DependencyProperty FloatingProperty = DependencyProperty.RegisterAttached(
        "Floating", typeof(bool), typeof(Material), new PropertyMetadata(false, FloatingChanged));

    public static void SetFloating(DependencyObject element, bool value) => element.SetValue(FloatingProperty, value);
    public static bool GetFloating(DependencyObject element) => (bool)element.GetValue(FloatingProperty);

    private static void FloatingChanged(DependencyObject element, DependencyPropertyChangedEventArgs args)
    {
        if (element is not Border surface)
            return;
        surface.Loaded -= FloatingLoaded;
        if ((bool)args.NewValue)
            surface.Loaded += FloatingLoaded;
    }

    private static void FloatingLoaded(object sender, RoutedEventArgs args)
    {
        var surface = (Border)sender;
        surface.SetResourceReference(Border.BackgroundProperty, "ShadeSolidSurfaceBrush");
        if (TryApplyBackdrop(PresentationSource.FromVisual(surface) as HwndSource, BackdropKind.Acrylic, extendFrame: true))
            surface.SetResourceReference(Border.BackgroundProperty, "ShadeQuickTintBrush");
    }

    public static void ApplyTransparentMenu(Border surface)
    {
        surface.SetResourceReference(Border.BackgroundProperty, "ShadeBackgroundBrush");
        if (SystemParameters.HighContrast || !TransparencyEnabled())
            return;
        // Layered popups use per-pixel alpha rather than a native acrylic backdrop.
        surface.SetResourceReference(Border.BackgroundProperty, "MenuTintBrush");
    }

    public static void ApplyTransient(Window window)
    {
        window.SetResourceReference(Window.BackgroundProperty, "ShadeBackgroundBrush");
        if (TryApplyBackdrop(PresentationSource.FromVisual(window) as HwndSource, BackdropKind.Acrylic, extendFrame: true))
            window.SetResourceReference(Window.BackgroundProperty, "ShadeQuickTintBrush");
    }

    public static void Apply(Window window)
    {
        window.SetResourceReference(Window.BackgroundProperty, "ShadeBackgroundBrush");
        var handle = new WindowInteropHelper(window).Handle;
        if (handle == 0)
            return;
        var source = HwndSource.FromHwnd(handle);
        if (TryApplyBackdrop(source, BackdropKind.Mica, extendFrame: WindowChrome.GetWindowChrome(window) is null))
            window.Background = Brushes.Transparent;
    }

    private static bool TryApplyBackdrop(HwndSource? source, BackdropKind kind, bool extendFrame)
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22621) || SystemParameters.HighContrast || source?.CompositionTarget is null)
            return false;
        if (kind == BackdropKind.Acrylic && !TransparencyEnabled())
            return false;
        try
        {
            var dark = 1;
            _ = DwmSetWindowAttribute(source.Handle, ImmersiveDarkModeAttribute, ref dark, sizeof(int));
            var backdrop = (int)kind;
            if (DwmSetWindowAttribute(source.Handle, SystemBackdropAttribute, ref backdrop, sizeof(int)) < 0)
                return false;
            if (extendFrame)
            {
                var margins = new Margins { Left = -1, Right = -1, Top = -1, Bottom = -1 };
                if (DwmExtendFrameIntoClientArea(source.Handle, ref margins) < 0)
                    return false;
            }
            source.CompositionTarget.BackgroundColor = Colors.Transparent;
            return true;
        }
        catch (Exception error) when (error is DllNotFoundException or EntryPointNotFoundException or BadImageFormatException)
        {
            Trace.TraceWarning("Native backdrop unavailable: {0}", error.Message);
            return false;
        }
    }

    private static bool TransparencyEnabled()
    {
        try
        {
            using var preferences = Registry.CurrentUser.OpenSubKey(PersonalizationKey);
            return preferences?.GetValue("EnableTransparency") is not int enabled || enabled != 0;
        }
        catch (Exception error) when (error is SecurityException or UnauthorizedAccessException or IOException)
        {
            Trace.TraceWarning("Cannot read transparency preference; using a solid background: {0}", error.Message);
            return false;
        }
    }
}
