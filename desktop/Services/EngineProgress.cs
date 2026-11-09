using System.Text.Json.Nodes;

namespace Organiza.Wpf.Services;

public enum ProgressKind
{
    Discovering, Analyzing, Organizing, Recycling, PartialAnalysis
}

public sealed record EngineProgress(ProgressKind Kind, long Completed = 0, long? Total = null, bool Partial = false)
{
    public static EngineProgress Analysis(JsonNode? value)
    {
        var total = value.N("total");
        if (value.B("partial") && value.N("completed") >= total)
            return new(ProgressKind.PartialAnalysis, Partial: true);
        return value.S("phase") == "analyzing" && total > 0
            ? new(ProgressKind.Analyzing, value.N("completed"), total, value.B("partial"))
            : new(ProgressKind.Discovering);
    }

    public static EngineProgress? Operation(JsonNode? value)
    {
        if (!value.B("busy") || value.N("total") <= 0)
            return null;
        return new(value.S("kind") == "trash" ? ProgressKind.Recycling : ProgressKind.Organizing,
            value?["completed"] is null ? value.N("index") : value.N("completed"), value.N("total"));
    }
}
