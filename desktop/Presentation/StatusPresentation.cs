namespace Organiza.Wpf.Presentation;

public enum StatusTone
{
    Neutral, Ready, Automatic, Manual, Attention, Success, Danger, Error
}

/// <summary>Semantic status colors shared by cards, file previews and operation history.</summary>
public sealed record StatusPresentation(AppIcon Icon, string Label, StatusTone Tone)
{
    public string BrushKey => BrushFor(Tone);

    public static string BrushFor(StatusTone tone) => tone switch
    {
        StatusTone.Neutral => "ShadeMutedTextBrush",
        StatusTone.Ready => "ShadeTextBrush",
        StatusTone.Automatic => "ShadeAccentBrush",
        StatusTone.Manual => "ShadeManualBrush",
        StatusTone.Attention => "ShadeWarningBrush",
        StatusTone.Success => "ShadeSuccessBrush",
        StatusTone.Danger or StatusTone.Error => "ShadeDangerBrush",
        _ => throw new ArgumentOutOfRangeException(nameof(tone), tone, "Estado visual desconhecido.")
    };

    public static StatusPresentation FolderMode(bool automatic) => automatic
        ? new(AppIcon.Play, "Automática", StatusTone.Automatic)
        : new(AppIcon.Pause, "Manual", StatusTone.Manual);
}
