using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Organiza.Wpf.Services;

public sealed record FolderDraft(
    [property: JsonPropertyName("path")] string Path,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("includeSubfolders")] bool IncludeSubfolders);

public sealed record SettingsPatch
{
    [JsonPropertyName("compactView"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? CompactView
    {
        get; init;
    }
    [JsonPropertyName("launchAtLogin"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? LaunchAtLogin
    {
        get; init;
    }
    [JsonPropertyName("confirmRemoval"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? ConfirmRemoval
    {
        get; init;
    }
}

/// <summary>The UI-facing engine API. Protocol command names and argument order live here only.</summary>
public sealed class OrganizaClient : IDisposable
{
    public string? ProfileDirectory => _engine.ProfileDirectory;
    private readonly IEngine _engine;
    private bool _disposed;
    public event Action? StateChanged;
    public event Action<string>? Exited;
    public event Action<EngineProgress>? AnalysisProgress;
    public event Action<bool, EngineProgress?>? OperationProgress;

    public OrganizaClient(IEngine engine)
    {
        _engine = engine;
        _engine.Changed += OnChanged;
    }

    private void OnChanged(string name, JsonNode? value)
    {
        if (_disposed)
            return;
        switch (name)
        {
            case "engine:exit":
                Exited?.Invoke(value?.ToString() ?? "O motor foi encerrado.");
                break;
            case "organizer:changed":
                StateChanged?.Invoke();
                break;
            case "preview:progress":
                AnalysisProgress?.Invoke(EngineProgress.Analysis(value));
                break;
            case "organizer:progress":
                OperationProgress?.Invoke(value.B("busy"), EngineProgress.Operation(value));
                break;
        }
    }

    private Task<JsonNode?> Call(string method, params object?[] args)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
        return _engine.Call(method, args);
    }

    public Task<JsonNode?> GetState() => Call("state:get");
    public Task<JsonNode?> SaveFolder(FolderDraft draft, string? id = null) => Call("folder:save", draft, id);
    public Task<JsonNode?> RemoveFolder(string id) => Call("folder:remove", id);
    public async Task<string> GetFolderPath(string id) => (await Call("folder:path", id))?.ToString() ?? throw new InvalidOperationException("Caminho indisponível.");
    // Rule/policy editor values deliberately follow the engine's existing dynamic schema.
    public Task<JsonNode?> SaveRule(string folder, object draft, string? id) => Call("rule:save", folder, draft, id);
    public Task<JsonNode?> ToggleRule(string folder, string id) => Call("rule:toggle", folder, id);
    public Task<JsonNode?> RemoveRule(string folder, string id) => Call("rule:remove", folder, id);
    public Task<JsonNode?> AddPresetRules(string folder) => Call("rule:presets", folder);
    public Task<JsonNode?> SavePolicy(string folder, object draft) => Call("policy:save", folder, draft);
    public Task<JsonNode?> Scan(string folder) => Call("preview:scan", folder);
    public Task<JsonNode?> Resolve(string preview, string row, string rule) => Call("preview:resolve", preview, row, rule);
    public Task<JsonNode?> Assign(string preview, string[] rows, object draft) => Call("review:assign", preview, rows, draft);
    public Task<JsonNode?> Keep(string preview, string[] rows) => Call("review:keep", preview, rows);
    public Task<JsonNode?> Defer(string preview, string[] rows) => Call("review:defer", preview, rows);
    public Task<JsonNode?> Resume(string preview) => Call("review:resume", preview);
    public Task<JsonNode?> PlanOrganization(string preview, string[] rows) => Call("organize:plan", preview, rows);
    public Task<JsonNode?> Organize(string plan, bool approved) => Call("organize:execute", plan, approved);
    public Task<JsonNode?> PlanRecycling(string preview, string[] rows) => Call("trash:plan", preview, rows);
    public Task<JsonNode?> Recycle(string plan) => Call("trash:execute", plan);
    public Task<JsonNode?> GetHistory() => Call("history:list");
    public Task<JsonNode?> RecoverHistory() => Call("history:recover");
    public Task<JsonNode?> Undo(string id) => Call("history:undo", id);
    public async Task<string> GetHistoryPath(string id, bool source) => (await Call("history:path", id, source ? "source" : "destination"))?.ToString() ?? throw new InvalidOperationException("Caminho indisponível.");
    public Task<JsonNode?> ActivateMonitoring(string[] ids) => Call("monitor:activate", (object)ids);
    public Task<JsonNode?> ReconcileMonitoring() => Call("monitor:reconcile");
    public Task<JsonNode?> RestoreMonitoring() => Call("monitor:restore");
    public Task<JsonNode?> PauseAllMonitoring() => Call("monitor:pause-all");
    public Task<JsonNode?> PauseMonitoring(string id) => Call("monitor:pause", id);
    public Task<JsonNode?> UpdateSettings(SettingsPatch patch) => Call("settings:update", patch);
    public async Task Cancel()
    {
        await Call("organize:cancel");
        await Call("preview:cancel");
        await Call("monitor:suspend");
    }
    public Task Shutdown() => _engine.Shutdown();
    public void Dispose()
    {
        if (_disposed)
            return;
        _disposed = true;
        _engine.Changed -= OnChanged;
    }
}
