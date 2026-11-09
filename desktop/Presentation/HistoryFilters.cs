namespace Organiza.Wpf.Presentation;

public sealed class HistoryFilters
{
    public string Query { get; set; } = "";
    public string FolderId { get; set; } = "";
    public string Period { get; set; } = "week";
    public string Status { get; set; } = "all";
    public int Page
    {
        get; set;
    }

    public IEnumerable<HistoryRecord> Apply(IEnumerable<HistoryRecord> records, DateTime today)
    {
        var since = Period switch
        {
            "today" => today.Date,
            "week" => today.Date.AddDays(-6),
            "month" => today.Date.AddDays(-29),
            _ => DateTime.MinValue
        };
        return records.Where(record =>
            (FolderId.Length == 0 || record.FolderId == FolderId) &&
            (Status switch
            {
                "organized" => record.Status is "moved" or "undone",
                "trash" => record.IsRecycled,
                "attention" => record.NeedsAttention,
                _ => true
            }) &&
            (record.Time is not { } time || time.Date >= since) &&
            record.SearchText.Contains(Query, StringComparison.OrdinalIgnoreCase));
    }

    public void Clear()
    {
        Query = "";
        FolderId = "";
        Period = "all";
        Status = "all";
        Page = 0;
    }
}
