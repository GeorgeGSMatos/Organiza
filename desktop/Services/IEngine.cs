using System.Text.Json.Nodes;

namespace Organiza.Wpf.Services;

public interface IEngine
{
    string? ProfileDirectory => null;
    event Action<string, JsonNode?>? Changed;
    Task<JsonNode?> Call(string method, params object?[] args);
    Task Shutdown();
}
