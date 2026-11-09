namespace Organiza.Wpf.Presentation;

public enum AppIcon
{
    Home, Folder, Rules, History, Settings, More, Edit, Trash, Clear, Refresh, Warning, Check, Search,
    Add, ChevronRight, Back, Play, Pause, Activity, Power, Shield, Help, Info, Undo, Document, Image, Table, Audio, Archive, Code, Device
}

public static class AppIcons
{
    public static string SearchGlyph => Glyph(AppIcon.Search);
    public static string FolderGlyph => Glyph(AppIcon.Folder);
    public static string Glyph(AppIcon icon) => icon switch
    {
        AppIcon.Home => "\uE80F",
        AppIcon.Folder => "\uE8B7",
        AppIcon.Rules => "\uE9E9",
        AppIcon.History => "\uE81C",
        AppIcon.Settings => "\uE713",
        AppIcon.More => "\uE712",
        AppIcon.Edit => "\uE70F",
        AppIcon.Trash => "\uE74D",
        AppIcon.Clear => "\uE711",
        AppIcon.Refresh => "\uE72C",
        AppIcon.Warning => "\uE7BA",
        AppIcon.Check => "\uE73E",
        AppIcon.Search => "\uE721",
        AppIcon.Add => "\uE710",
        AppIcon.ChevronRight => "\uE76C",
        AppIcon.Back => "\uE72B",
        AppIcon.Play => "\uE768",
        AppIcon.Pause => "\uE769",
        AppIcon.Activity => "\uE9D9",
        AppIcon.Power => "\uE7E8",
        AppIcon.Shield => "\uE83D",
        AppIcon.Help => "\uE897",
        AppIcon.Info => "\uE946",
        AppIcon.Undo => "\uE7A7",
        AppIcon.Document => "\uE8A5",
        AppIcon.Image => "\uEB9F",
        AppIcon.Table => "\uE80A",
        AppIcon.Audio => "\uE8D6",
        AppIcon.Archive => "\uF012",
        AppIcon.Code => "\uE943",
        AppIcon.Device => "\uE7F4",
        _ => throw new ArgumentOutOfRangeException(nameof(icon))
    };
}
