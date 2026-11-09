using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;

namespace Organiza.Wpf.Presentation.Controls;

public sealed class SearchField : TextBox
{
    public SearchField()
    {
        SetResourceReference(StyleProperty, typeof(SearchField));
        Tag = "Buscar";
        AutomationProperties.SetName(this, "Buscar");
    }
}
