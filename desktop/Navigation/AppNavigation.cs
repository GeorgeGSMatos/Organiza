using Organiza.Wpf.Presentation;

namespace Organiza.Wpf.Navigation;

public enum AppPage
{
    Overview, Folders, Rules, History, Settings
}

public sealed record PageDefinition(AppPage Page, string Title, AppIcon Icon);

public static class AppPages
{
    public static IReadOnlyList<PageDefinition> All
    {
        get;
    } = Array.AsReadOnly(new[]
    {
        new PageDefinition(AppPage.Overview, "Visão geral", AppIcon.Home),
        new PageDefinition(AppPage.Folders, "Pastas", AppIcon.Folder),
        new PageDefinition(AppPage.Rules, "Regras", AppIcon.Rules),
        new PageDefinition(AppPage.History, "Histórico", AppIcon.History),
        new PageDefinition(AppPage.Settings, "Configurações", AppIcon.Settings)
    });

    public static PageDefinition Get(AppPage page) => All.FirstOrDefault(item => item.Page == page)
        ?? throw new ArgumentOutOfRangeException(nameof(page));
}

/// <summary>Navigation context only; no controls, engine calls or file operations.</summary>
public sealed class AppNavigation
{
    public AppPage Page { get; private set; } = AppPage.Overview;
    public string FolderId { get; private set; } = "";
    public bool IsFolderOpen
    {
        get; private set;
    }
    public bool CanReturnToFolder
    {
        get; private set;
    }
    public event EventHandler? Changed;

    public void Navigate(AppPage page)
    {
        _ = AppPages.Get(page);
        Page = page;
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public void ShowFolders()
    {
        IsFolderOpen = false;
        CanReturnToFolder = false;
        Navigate(AppPage.Folders);
    }

    public void OpenFolder(string id)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        FolderId = id;
        IsFolderOpen = true;
        CanReturnToFolder = false;
        Navigate(AppPage.Folders);
    }

    public void ShowFolderRules()
    {
        CanReturnToFolder = IsFolderOpen;
        Navigate(AppPage.Rules);
    }

    public void SelectRulesFolder(string id)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(id);
        FolderId = id;
        IsFolderOpen = false;
        CanReturnToFolder = false;
        Navigate(AppPage.Rules);
    }

    // Called while reconciling a snapshot, before rendering. Does not recursively navigate.
    public void ReconcileFolders(IEnumerable<string> ids)
    {
        var available = ids.ToList();
        if (available.Contains(FolderId))
            return;
        FolderId = available.FirstOrDefault() ?? "";
        IsFolderOpen = false;
        CanReturnToFolder = false;
    }
}
