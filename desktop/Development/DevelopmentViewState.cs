using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf.Development;

public sealed record DevelopmentViewState
{
    public AppPage Page { get; init; }
    public string FolderId { get; init; } = "";
    public string PreviewQuery { get; init; } = "";
    public string PreviewFilter { get; init; } = "all";
    public string RuleQuery { get; init; } = "";
    public HistoryFilters History { get; init; } = new();
    public bool HadPreview { get; init; }
    public string[] SelectedIds { get; init; } = [];
    public double Width { get; init; } = 1280;
    public double Height { get; init; } = 850;
    public double Left { get; init; }
    public double Top { get; init; }
}
