using System.IO;

namespace Organiza.Wpf.Development;

public sealed record DevelopmentOptions(string SourceRoot, string ControlDirectory, string Revision, bool Demo, bool Hidden)
{
    public string ProfileDirectory => Path.Combine(SourceRoot, ".dev", "profile");
    public string StateFile => Path.Combine(ProfileDirectory, "window-state.json");

    public static DevelopmentOptions? Parse(string[] args)
    {
        if (!args.Contains("--development")) return null;
#if !DEBUG
        throw new InvalidOperationException("O modo de desenvolvimento exige uma compilação Debug.");
#else
        string Value(string key)
        {
            var index = Array.IndexOf(args, key);
            if (index < 0 || index + 1 >= args.Length) throw new ArgumentException("Argumento de desenvolvimento ausente: " + key);
            return args[index + 1];
        }
        var root = Path.GetFullPath(Value("--development"));
        if (!Directory.Exists(Path.Combine(root, "desktop", "Styles"))) throw new ArgumentException("Pasta do projeto não encontrada.");
        var control = Path.GetFullPath(Value("--dev-control"));
        var expected = Path.Combine(root, ".dev", "control") + Path.DirectorySeparatorChar;
        if (!control.StartsWith(expected, StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Pasta de controle inválida.");
        return new(root, control, Value("--dev-revision"), args.Contains("--dev-demo"), args.Contains("--dev-hidden"));
#endif
    }
}
