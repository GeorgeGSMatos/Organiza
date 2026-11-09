using System.Text.Json.Nodes;

namespace Organiza.Wpf;

public static class JsonValues
{
    public static string S(this JsonNode? node, string key, string fallback = "") => node?[key]?.ToString() ?? fallback;
    public static bool B(this JsonNode? node, string key, bool fallback = false) => bool.TryParse(node?[key]?.ToString(), out var value) ? value : fallback;
    public static long N(this JsonNode? node, string key, long fallback = 0) => long.TryParse(node?[key]?.ToString(), out var value) ? value : fallback;
    public static IEnumerable<JsonNode> Items(this JsonNode? node, string key) => (node?[key] as JsonArray)?.OfType<JsonNode>() ?? [];
}
