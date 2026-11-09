using System.Windows;
using System.Windows.Controls;
using Organiza.Wpf.Presentation;

internal static class InterfaceIdentityChecks
{
    public static async Task Run(Action<bool, string> check)
    {
        var search = Ui.Search("", "Buscar arquivos", compact: true);
        var folderName = Ui.Input("", "Nome no Organiza");
        folderName.SetResourceReference(FrameworkElement.StyleProperty, "CompactTextInput");
        folderName.Width = 260;
        var content = Ui.Stack(search, folderName);
        var host = new Window
        {
            Content = content, Width = 400, Height = 200,
            Left = -20000, Top = -20000, ShowActivated = false, ShowInTaskbar = false,
            WindowStartupLocation = WindowStartupLocation.Manual
        };
        try
        {
            host.Show();
            foreach (var input in new TextBox[] { search, folderName })
            {
                input.Text = "Ágjç 123 teste";
                host.UpdateLayout();
                await Task.Delay(50);
                input.ApplyTemplate();
                var scroll = (ScrollViewer)input.Template.FindName("PART_ContentHost", input);
                var caret = input.GetRectFromCharacterIndex(1);
                check(Math.Abs(input.ActualHeight - 32) < 1, "Compact " + input.GetType().Name + " keeps the requested height when typing");
                check(!caret.IsEmpty && caret.Top >= 0 && caret.Bottom <= input.ActualHeight + 1 && scroll.ViewportHeight >= caret.Height - 1,
                    "Compact " + input.GetType().Name + " fits the complete text line without clipping");
                check(Math.Abs(caret.Top - (input.ActualHeight - caret.Height) / 2) <= 2,
                    "Compact " + input.GetType().Name + " centers typed text vertically");
            }
        }
        finally { host.Close(); }
    }
}
