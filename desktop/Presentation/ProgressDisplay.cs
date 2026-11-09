using Organiza.Wpf.Services;

namespace Organiza.Wpf.Presentation;

public sealed record ProgressDisplay(string Message, bool IsIndeterminate, double Percent)
{
    public static ProgressDisplay From(EngineProgress progress)
    {
        var label = progress.Kind switch
        {
            ProgressKind.Discovering => "Localizando arquivos…",
            ProgressKind.PartialAnalysis => "Concluindo análise parcial…",
            ProgressKind.Analyzing => progress.Partial ? "Analisando seleção parcial" : "Analisando",
            ProgressKind.Recycling => "Enviando à Lixeira",
            _ => "Organizando"
        };
        if (progress.Total is not > 0)
            return new(label, true, 0);
        var completed = Math.Clamp(progress.Completed, 0, progress.Total.Value);
        var percent = completed * 100d / progress.Total.Value;
        return new($"{label} · {percent:0}% · {completed} de {progress.Total} arquivos", false, percent);
    }
}
