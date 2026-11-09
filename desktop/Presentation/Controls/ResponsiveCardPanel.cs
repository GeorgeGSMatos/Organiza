using System.Windows;
using System.Windows.Controls;

namespace Organiza.Wpf.Presentation.Controls;

public sealed class ResponsiveCardPanel : WrapPanel
{
    public static readonly DependencyProperty GapProperty = DependencyProperty.Register(nameof(Gap), typeof(double), typeof(ResponsiveCardPanel), new FrameworkPropertyMetadata(0d, Resize));
    public static readonly DependencyProperty MinimumCardWidthProperty = DependencyProperty.Register(nameof(MinimumCardWidth), typeof(double), typeof(ResponsiveCardPanel), new FrameworkPropertyMetadata(0d, Resize));
    public static readonly DependencyProperty ColumnsBreakpointProperty = DependencyProperty.Register(nameof(ColumnsBreakpoint), typeof(double), typeof(ResponsiveCardPanel), new FrameworkPropertyMetadata(0d, Resize));
    public double Gap
    {
        get => (double)GetValue(GapProperty); set => SetValue(GapProperty, value);
    }
    public double MinimumCardWidth
    {
        get => (double)GetValue(MinimumCardWidthProperty); set => SetValue(MinimumCardWidthProperty, value);
    }
    public double ColumnsBreakpoint
    {
        get => (double)GetValue(ColumnsBreakpointProperty); set => SetValue(ColumnsBreakpointProperty, value);
    }

    public ResponsiveCardPanel()
    {
        SizeChanged += (_, _) => ArrangeCards();
        Loaded += (_, _) => ArrangeCards();
    }
    private static void Resize(DependencyObject source, DependencyPropertyChangedEventArgs args) => ((ResponsiveCardPanel)source).ArrangeCards();
    protected override void OnVisualChildrenChanged(DependencyObject added, DependencyObject removed)
    {
        base.OnVisualChildrenChanged(added, removed);
        ArrangeCards();
    }

    private void ArrangeCards()
    {
        var width = Math.Max(MinimumCardWidth + Gap, ActualWidth);
        var columns = ColumnsBreakpoint > 0 && width >= ColumnsBreakpoint ? 2 : 1;
        // Leave one layout pixel per column for DPI rounding.
        var cardWidth = Math.Max(MinimumCardWidth, width / columns - Gap - 1);
        foreach (FrameworkElement card in Children)
        {
            card.Width = cardWidth;
            card.Margin = new Thickness(0, 0, Gap, Gap);
        }
    }
}
