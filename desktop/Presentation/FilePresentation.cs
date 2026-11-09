namespace Organiza.Wpf.Presentation;

public static class FilePresentation
{
    public static AppIcon TypeIcon(string type) => type switch
    {
        "image" or "video" => AppIcon.Image,
        "spreadsheet" => AppIcon.Table,
        "audio" => AppIcon.Audio,
        "archive" or "installer" => AppIcon.Archive,
        _ => AppIcon.Document
    };

    public static StatusPresentation DescribeStatus(string status) => status switch
    {
        "ready" => new(AppIcon.Check, "Pronto", StatusTone.Ready),
        "review" => new(AppIcon.Warning, "Revisar", StatusTone.Attention),
        "conflict" => new(AppIcon.Warning, "Conflito", StatusTone.Attention),
        "ignored" => new(AppIcon.Pause, "Ignorado", StatusTone.Neutral),
        "moved" => new(AppIcon.Check, "Organizado", StatusTone.Success),
        "undone" => new(AppIcon.Undo, "Desfeito", StatusTone.Success),
        "failed" => new(AppIcon.Warning, "Não concluído", StatusTone.Error),
        "trashed" => new(AppIcon.Trash, "Na Lixeira", StatusTone.Danger),
        "prepared" => new(AppIcon.Warning, "Interrompido", StatusTone.Attention),
        _ => new(AppIcon.Warning, "Conferir", StatusTone.Attention)
    };

    public static AppIcon StatusIcon(string status) => DescribeStatus(status).Icon;
    public static string StatusBrush(string status) => DescribeStatus(status).BrushKey;
    public static string StatusLabel(string status) => DescribeStatus(status).Label;

    public static string Quantity(int count, string singular, string plural) => $"{count} {(count == 1 ? singular : plural)}";
    public static string RelativeTime(DateTime time, DateTime now)
    {
        var elapsed = now - time;
        if (elapsed.TotalMinutes < 1)
            return "agora";
        if (elapsed.TotalHours < 1)
            return $"há {(int)elapsed.TotalMinutes} min";
        if (elapsed.TotalDays < 1)
            return $"há {(int)elapsed.TotalHours} h";
        return time.ToString("dd/MM 'às' HH:mm");
    }
}
