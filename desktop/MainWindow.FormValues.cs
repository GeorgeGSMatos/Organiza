using System.Globalization;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private static double ParseFormNumber(string value, string name)
    {
        if (!double.TryParse(value.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var number) || !double.IsFinite(number))
            throw new InvalidOperationException(name + ": informe um número válido.");
        return number;
    }
}
