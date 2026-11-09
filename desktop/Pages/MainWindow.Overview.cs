using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private void Overview()
    {
        Header(AppPage.Overview, "Suas pastas, sob controle.", LabeledAction(AppIcon.Add, "Adicionar pasta", EditFolder, true));
        var active = _state!["monitor"].Items("activeIds").Count();
        var known = Folders.Where(folder => _summaries.ContainsKey(folder.S("id"))).ToList();
        var review = known.Sum(folder => _summaries[folder.S("id")].Review);
        var complete = known.Count == Folders.Count() && known.Count > 0;
        var summary = new UniformGrid { Columns = 3, Margin = new Thickness(0, 8, 0, 20) };
        summary.Children.Add(SummaryItem(AppIcon.Folder, FilePresentation.Quantity(Folders.Count(), "pasta", "pastas"), Folders.Count() == 1 ? "Cadastrada no Organiza" : "Cadastradas no Organiza"));
        summary.Children.Add(SummaryItem(AppIcon.Activity, $"{active} em monitoramento", active > 0 ? "Organização automática ativa" : "Monitoramento pausado", StatusPresentation.BrushFor(active > 0 ? StatusTone.Automatic : StatusTone.Neutral)));
        summary.Children.Add(SummaryItem(review > 0 ? AppIcon.Warning : AppIcon.Check, complete ? $"{review} para revisar" : review > 0 ? $"{review}+ para revisar" : "Análise pendente",
            complete ? "Arquivos que precisam de atenção" : known.Count > 0 ? "Nas pastas já analisadas" : "Analise suas pastas para conferir", StatusPresentation.BrushFor(review > 0 ? StatusTone.Attention : StatusTone.Neutral)));
        PageContent.Children.Add(summary);
        PageContent.Children.Add(Ui.Section("Continuar organizando"));
        FolderCards(Folders);
        PageContent.Children.Add(Ui.Section("Última atividade"));
        var latest = _history.Items("entries").FirstOrDefault();
        if (_history is null)
        {
            PageContent.Children.Add(Ui.Text("Carregando atividade…", TextRole.Caption, true));
            _ = LoadHistory();
        }
        else if (latest is null)
            PageContent.Children.Add(Ui.Text("Ainda não há movimentações. Abra uma pasta para começar.", TextRole.Caption, true));
        else
        {
            var record = new HistoryRecord(latest);
            var name = Ui.Ellipsis(record.Name, TextRole.Label, bold: true);
            var status = Ui.Status(FilePresentation.DescribeStatus(record.Status));
            var timestamp = Ui.Text(record.Time is { } time ? FilePresentation.RelativeTime(time.LocalDateTime, DateTime.Now) : "", TextRole.Caption, true);
            timestamp.Margin = DesignResources.Spacing("OverviewActivityTimeMargin");
            timestamp.ToolTip = record.Time?.ToLocalTime().ToString("dd/MM/yyyy HH:mm");
            var metadata = Ui.Inline(status, timestamp);
            metadata.Margin = DesignResources.Spacing("OverviewActivityMetadataMargin");
            var content = Ui.Stack(name, metadata);
            var history = Ui.LabeledIcon(AppIcon.History, "Ver histórico", () => _navigation.Navigate(AppPage.History));
            history.Margin = DesignResources.Spacing("OverviewActivityActionMargin");
            var row = Ui.Toolbar(content, history);
            row.Margin = new Thickness(0);
            PageContent.Children.Add(Ui.Card(row));
        }
        _pageStatus = FilePresentation.Quantity(active, "pasta em monitoramento", "pastas em monitoramento");
    }

    private static Border SummaryItem(AppIcon icon, string title, string description, string? brush = null)
    {
        var glyph = Ui.Glyph(icon, large: true);
        glyph.Margin = new Thickness(0, 0, 16, 0);
        if (brush is not null)
            glyph.SetResourceReference(TextBlock.ForegroundProperty, brush);
        var label = Ui.Text(title, TextRole.Label, bold: true);
        var hint = Ui.Text(description, TextRole.Caption, true);
        hint.Margin = new Thickness(0, 5, 0, 0);
        return new Border { Child = Ui.IconContent(glyph, Ui.Stack(label, hint)), Padding = new Thickness(0, 14, 16, 14) };
    }
}
