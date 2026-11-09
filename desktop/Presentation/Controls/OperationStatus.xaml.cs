using System.Windows;
using System.Windows.Controls;

namespace Organiza.Wpf.Presentation.Controls;

public partial class OperationStatus : UserControl
{
    public OperationStatus()
    {
        InitializeComponent();
        Indicator.Text = AppIcons.Glyph(AppIcon.Check);
    }
    public string Message
    {
        get => StatusText.Text; set => StatusText.Text = value;
    }

    public void ShowProgress(ProgressDisplay display)
    {
        Message = display.Message;
        Progress.Visibility = Visibility.Visible;
        Progress.IsIndeterminate = display.IsIndeterminate;
        Progress.Value = display.Percent;
        Indicator.Text = AppIcons.Glyph(AppIcon.Refresh);
        ApplyTone(StatusTone.Automatic);
        UiMotion.RotateFeedback(Indicator);
    }

    public void HideProgress() => Progress.Visibility = Visibility.Collapsed;
    public void SetIdle(string message, AppIcon icon, StatusTone tone = StatusTone.Neutral)
    {
        Message = message;
        Indicator.Text = AppIcons.Glyph(icon);
        ApplyTone(tone);
    }
    private void ApplyTone(StatusTone tone)
    {
        var brush = StatusPresentation.BrushFor(tone);
        Indicator.SetResourceReference(TextBlock.ForegroundProperty, brush);
        StatusText.SetResourceReference(TextBlock.ForegroundProperty, brush);
    }

    public void Complete(bool partial)
    {
        Indicator.Text = AppIcons.Glyph(partial ? AppIcon.Warning : AppIcon.Check);
        ApplyTone(partial ? StatusTone.Attention : StatusTone.Ready);
        UiMotion.Enter(Indicator);
    }
}
