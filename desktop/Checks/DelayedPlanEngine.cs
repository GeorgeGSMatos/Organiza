using System.Text.Json.Nodes;
using Organiza.Wpf.Services;

/// <summary>Forces the real planning request to yield before its confirmation opens.</summary>
internal sealed class DelayedPlanEngine(IEngine inner) : IEngine
{
    public string? ProfileDirectory => inner.ProfileDirectory;
    public int DelayedPlans { get; private set; }
    public event Action<string, JsonNode?>? Changed
    {
        add => inner.Changed += value;
        remove => inner.Changed -= value;
    }

    public async Task<JsonNode?> Call(string method, params object?[] args)
    {
        if (method is "organize:plan" or "trash:plan")
        {
            DelayedPlans++;
            await Task.Delay(TimeSpan.FromMilliseconds(150));
        }
        return await inner.Call(method, args);
    }

    public Task Shutdown() => inner.Shutdown();
}
