using System.Windows;
using System.Windows.Controls;

namespace Organiza.Wpf.Presentation.Controls;

public sealed class FilterTab : Button
{
    public static readonly DependencyProperty IsActiveProperty = DependencyProperty.Register(nameof(IsActive), typeof(bool), typeof(FilterTab), new PropertyMetadata(false));
    public bool IsActive
    {
        get => (bool)GetValue(IsActiveProperty); set => SetValue(IsActiveProperty, value);
    }
    public FilterTab() => SetResourceReference(StyleProperty, typeof(FilterTab));
}
