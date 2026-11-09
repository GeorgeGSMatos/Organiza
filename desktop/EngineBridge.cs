using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

using Organiza.Wpf.Services;

namespace Organiza.Wpf;

public sealed class EngineBridge : IEngine
{
    public string ProfileDirectory
    {
        get;
    }
    private readonly Process _process;
    private readonly ConcurrentDictionary<long, TaskCompletionSource<JsonNode?>> _pending = new();
    private readonly SemaphoreSlim _write = new(1);
    private readonly TaskCompletionSource _ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly ChildJob _job;
    private long _sequence;
    private bool _stopping;
    private string _error = "O motor de organização foi encerrado. Reabra o app e confira o histórico.";
    public event Action<string, JsonNode?>? Changed;
    public bool HasExited => _process.HasExited;

    private EngineBridge(string root, string profile)
    {
        ProfileDirectory = profile;
        var node = Path.Combine(root, "runtime", "node.exe");
        if (!File.Exists(node))
            throw new IOException("Extraia todo o pacote: o motor local não foi encontrado.");
        var start = new ProcessStartInfo(node) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8, StandardInputEncoding = new UTF8Encoding(false), WorkingDirectory = root };
        start.ArgumentList.Add(Path.Combine(root, "engine", "engine", "worker.cjs"));
        start.ArgumentList.Add(profile);
        start.ArgumentList.Add(root);
        _process = new Process { StartInfo = start, EnableRaisingEvents = true };
        _job = new ChildJob();
        _process.Start();
        try
        {
            _job.Attach(_process);
        }
        catch { _process.Kill(true); _job.Dispose(); throw; }
        _process.Exited += (_, _) => { if (!_stopping) Fail(new IOException(_error)); };
        _ = Read();
        _ = ReadErrors();
    }
    public static async Task<EngineBridge> Start(string root, string profile)
    {
        var bridge = new EngineBridge(root, profile);
        try
        {
            await bridge._ready.Task.WaitAsync(TimeSpan.FromSeconds(30));
            return bridge;
        }
        catch { bridge._job.Dispose(); throw; }
    }
    private void Fail(Exception error)
    {
        _ready.TrySetException(error);
        foreach (var entry in _pending)
            if (_pending.TryRemove(entry.Key, out var request))
                request.TrySetException(error);
        if (!_stopping)
            Changed?.Invoke("engine:exit", JsonValue.Create(error.Message));
    }
    private async Task ReadErrors()
    {
        try
        {
            while (await _process.StandardError.ReadLineAsync() is { } line)
                _error = line.Length > 2048 ? line[..2048] : line;
        }
        catch (Exception error) when (error is IOException or ObjectDisposedException or InvalidOperationException)
        {
            Trace.TraceWarning("Engine diagnostic stream closed: {0}", error.Message);
        }
    }
    private async Task Read()
    {
        try
        {
            while (await _process.StandardOutput.ReadLineAsync() is { } line)
            {
                var message = JsonNode.Parse(line) ?? throw new IOException("Resposta inválida do motor.");
                if (message.B("ready"))
                {
                    _ready.TrySetResult();
                    continue;
                }
                if (message["fatal"] is not null)
                    throw new IOException(message.S("fatal"));
                if (message["hostId"] is not null)
                {
                    var id = message.N("hostId");
                    try
                    {
                        if (message.S("method") != "recycle")
                            throw new IOException("Recurso nativo não permitido.");
                        await RecycleBin.Send(message["value"].S("path"));
                        await Send(new
                        {
                            hostReply = id,
                            ok = true
                        });
                    }
                    catch (Exception error) { await Send(new { hostReply = id, ok = false, error = error.Message }); }
                    continue;
                }
                if (message["event"] is not null)
                {
                    Changed?.Invoke(message.S("event"), message["value"]?.DeepClone());
                    continue;
                }
                if (_pending.TryRemove(message.N("id"), out var pending))
                {
                    if (message.B("ok"))
                        pending.TrySetResult(message["value"]?.DeepClone());
                    else
                        pending.TrySetException(new InvalidOperationException(message.S("error")));
                }
            }
            Fail(new IOException(_error));
        }
        catch (Exception error) { Fail(error); }
    }
    private async Task Send(object value)
    {
        await _write.WaitAsync();
        try
        {
            await _process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(value));
            await _process.StandardInput.FlushAsync();
        }
        finally { _write.Release(); }
    }
    public async Task<JsonNode?> Call(string method, params object?[] args)
    {
        var id = Interlocked.Increment(ref _sequence);
        var pending = new TaskCompletionSource<JsonNode?>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pending[id] = pending;
        try
        {
            await Send(new
            {
                id,
                method,
                args
            });
            return await pending.Task;
        }
        catch { _pending.TryRemove(id, out _); throw; }
    }
    public async Task Shutdown()
    {
        _stopping = true;
        if (!_process.HasExited)
        {
            await Call("shutdown");
            await _process.WaitForExitAsync();
        }
        _job.Dispose();
        _process.Dispose();
    }
}
