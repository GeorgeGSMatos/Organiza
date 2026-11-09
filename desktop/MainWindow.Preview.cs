using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;
using Organiza.Wpf.Services;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private string _automaticAnalysisFolder = "";
    private readonly HashSet<string> _retainedPreviewSelection = [];

    private void QueueFolderAnalysis() => Dispatcher.BeginInvoke(new Action(() =>
    {
        if (_navigation.Page != AppPage.Folders || Folder is null || _closing || _working || _engineBusy || _scanning || _dialogDepth > 0) return;
        var id = _navigation.FolderId;
        if (_preview is not null || _automaticAnalysisFolder == id) return;
        _automaticAnalysisFolder = id;
        Execute(Scan);
    }));

    private static bool SameFolderConfiguration(JsonNode? left, JsonNode? right)
    {
        JsonNode? Configuration(JsonNode? node)
        {
            var copy = node?.DeepClone();
            if (copy is JsonArray array)
                foreach (var folder in array.OfType<JsonObject>()) folder.Remove("organizationMode");
            return copy;
        }
        return JsonNode.DeepEquals(Configuration(left), Configuration(right));
    }

    private DataGrid? _previewGrid;
    private string _previewSort = "Name";
    private ListSortDirection _previewDirection = ListSortDirection.Ascending;
    private double _fileScroll;
    private void SetPreview(JsonNode? result)
    {
        var selected = _rows.Where(r => r.Selected).Select(r => r.Id).ToHashSet();
        if (result is null && _rows.Count > 0)
        {
            _retainedPreviewSelection.Clear();
            _retainedPreviewSelection.UnionWith(selected);
        }
        if (result is not null)
        {
            selected.UnionWith(_retainedPreviewSelection);
            _retainedPreviewSelection.Clear();
        }
        _preview = result;
        _rows.Clear();
        if (result is null)
            return;
        _rows.AddRange(result.Items("rows").Select(r => new PreviewItem(r) { Selected = selected.Contains(r.S("id")), Failure = _failures.GetValueOrDefault(r.S("id"), "") }));
        var folder = result.S("folderId");
        if (folder.Length == 0)
            return;
        if (result.B("limited") || result.B("cancelled") || result.Items("warnings").Any())
            _summaries.Remove(folder);
        else
            _summaries[folder] = (_rows.Count(row => row.Source.S("status") is "review" or "conflict"), DateTime.TryParse(result.S("createdAt"), out var time) ? time.ToLocalTime() : DateTime.Now);
    }
    private void ApplyReview(JsonNode? response)
    {
        var selected = _rows.Where(r => r.Selected).Select(r => r.Id).ToHashSet();
        Apply(response?["state"]);
        SetPreview(response?["preview"]);
        foreach (var row in _rows)
            row.Selected = selected.Contains(row.Id);
    }
    private async Task Scan()
    {
        _scope = _navigation.FolderId;
        _scanning = true;
        _automaticAnalysisFolder = _scope;
        if (_preview is null) Render();
        StopButton.Content = "Cancelar análise";
        StopButton.Visibility = Visibility.Visible;
        OperationStatus.ShowProgress(ProgressDisplay.From(new EngineProgress(ProgressKind.Discovering)));
        try
        {
            Apply(await Client.GetState());
            SetPreview(await Client.Scan(_scope));
            var partial = _preview.B("limited") || _preview.B("cancelled") || _preview.Items("warnings").Any();
            _notice = partial ? $"Análise parcial · {_rows.Count} arquivos. Confira os avisos." : $"Análise concluída · {_rows.Count} arquivos";
            _noticeIcon = partial ? AppIcon.Warning : AppIcon.Check;
            _noticeTone = partial ? StatusTone.Attention : StatusTone.Ready;
            OperationStatus.Complete(partial);
        }
        finally { _scanning = false; OperationStatus.HideProgress(); StopButton.Visibility = _engineBusy ? Visibility.Visible : Visibility.Collapsed; StopButton.Content = "Parar após este arquivo"; }
    }
    private IEnumerable<PreviewItem> VisibleRows() => _rows.Where(r => (_filter == "all" || (_filter == "review" ? r.Source.S("status") is "review" or "conflict" : r.Source.S("status") == _filter)) && (r.Name + r.Path + r.Destination).Contains(_previewQuery, StringComparison.OrdinalIgnoreCase));
    private static bool IsUnmatched(PreviewItem row) => row.Source.S("status") == "review" && row.Source.S("ignoreReason").Length == 0 && !row.Source.Items("candidates").Any();
    private JsonNode? ReviewGroup(PreviewItem row)
    {
        var group = _preview?["review"].Items("groups").FirstOrDefault(g => g.Items("rowIds").Any(id => id.ToString() == row.Id));
        if (group is null)
            return null;
        var one = group.DeepClone();
        one["files"] = new JsonArray(group.Items("files").Where(f => f.S("id") == row.Id).Select(f => f.DeepClone()).ToArray());
        return one;
    }
    private Task AssignSelected()
    {
        var selected = _rows.Where(r => r.Selected).ToList();
        if (selected.Count == 0 || selected.Any(r => !IsUnmatched(r)))
            throw new InvalidOperationException("Selecione arquivos sem regra para definir uma categoria.");
        var group = ReviewGroup(selected[0]) ?? throw new InvalidOperationException("Atualize a análise.");
        group["files"] = new JsonArray(selected.Select(r => (JsonNode)new JsonObject { ["id"] = r.Id, ["name"] = r.Name, ["relativePath"] = r.Source.S("relativePath") }).ToArray());
        group["mixed"] = selected.Select(r => System.IO.Path.GetExtension(r.Name).ToLowerInvariant()).Distinct().Count() > 1;
        if (group.B("mixed"))
        {
            group["extension"] = "Vários formatos";
            group["suggestion"] = new JsonObject { ["name"] = "", ["reason"] = "Escolha um destino para esta seleção." };
        }
        return ReviewDialog(group);
    }
    private async Task AfterOperation(JsonNode? result, string verb)
    {
        var completed = result.Items("completedIds").Select(n => n.ToString()).ToHashSet();
        var remaining = _rows.Where(r => r.Selected && !completed.Contains(r.Id)).Select(r => r.Id).ToHashSet();
        _failures.Clear();
        foreach (var failure in result.Items("failures"))
            _failures[failure.S("id")] = failure.S("message");
        var count = result.N(verb == "organizados" ? "moved" : "trashed");
        var message = $"{count} arquivos {verb}" + (result.N("failed") > 0 ? $" · {result.N("failed")} para conferir" : "") + (result.B("cancelled") ? " · Operação interrompida" : "");
        _history = null;
        await Refresh(false);
        try
        {
            await Scan();
            foreach (var row in _rows)
                row.Selected = remaining.Contains(row.Id);
        }
        catch (Exception error) { SetPreview(null); ShowError(message + ". Atualize a análise: " + error.Message); return; }
        _notice = message;
        _noticeIcon = result.N("failed") > 0 || result.B("cancelled") ? AppIcon.Warning : AppIcon.Check;
        _noticeTone = result.N("failed") > 0 ? StatusTone.Error : result.B("cancelled") ? StatusTone.Attention : count > 0 ? StatusTone.Success : StatusTone.Neutral;
        OperationStatus.Message = message;
    }
    private async Task OrganizeSelected()
    {
        var selected = _rows.Where(r => r.Selected).ToArray();
        if (selected.Length == 0 || selected.Any(r => !r.CanMove))
            throw new InvalidOperationException("Selecione arquivos com destino definido e resolva os conflitos.");
        var plan = await Client.PlanOrganization(_preview!.S("id"), selected.Select(r => r.Id).ToArray());
        var approve = new CheckBox { Content = "Revisei e aprovo os itens que exigem revisão", Margin = new Thickness(0, 12, 0, 12) };
        var dialog = new UiDialog(this, "Confirmar organização", $"{selected.Length} arquivos selecionados. Nenhum arquivo existente será substituído.", "Confirmar e organizar", () =>
        {
            if (plan.N("reviewCount") > 0 && approve.IsChecked != true)
                throw new InvalidOperationException("Aprove os itens que exigem revisão para continuar.");
            return Task.CompletedTask;
        }, 700);
        foreach (var entry in plan.Items("entries"))
            dialog.Body.Children.Add(Ui.Card(Ui.Stack(Ui.Text(entry.S("name"), bold: true), Ui.Text(entry.S("source"), TextRole.Caption, true), Ui.Text("→ " + entry.S("destination"), TextRole.Caption), Ui.Text(entry.B("renamed") ? "Nome ajustado para preservar o arquivo existente." : "", TextRole.Caption, true))));
        if (plan.N("reviewCount") > 0)
            dialog.Body.Children.Add(approve);
        if (!Dialog(dialog))
            return;
        await AfterOperation(await Client.Organize(plan!.S("id"), approve.IsChecked == true), "organizados");
    }
    private Task DecideRow(PreviewItem row)
    {
        var candidates = row.Source.Items("candidates").ToList();
        if (candidates.Count > 1)
        {
            var choice = Ui.Choice("Escolher regra", candidates.Select(c => (c.S("ruleId"), c.S("ruleName") + " → " + c.S("destination"))), candidates[0].S("ruleId"));
            var dialog = new UiDialog(this, "Resolver conflito", row.Name, "Usar esta regra", async () => SetPreview(await Client.Resolve(_preview!.S("id"), row.Id, Ui.Value(choice))));
            dialog.Body.Children.Add(choice);
            Dialog(dialog);
            return Task.CompletedTask;
        }
        var group = ReviewGroup(row);
        return group is not null ? ReviewDialog(group) : Task.CompletedTask;
    }
    private async Task TrashSelected()
    {
        var selected = _rows.Where(r => r.Selected).ToList();
        if (selected.Count == 0)
            throw new InvalidOperationException("Selecione os arquivos para enviar à Lixeira.");
        var plan = await Client.PlanRecycling(_preview!.S("id"), selected.Select(r => r.Id).ToArray());
        var size = plan.Items("entries").Sum(e => e.N("size"));
        var dialog = new UiDialog(this, "Enviar à Lixeira?", $"{selected.Count} arquivos · {size / 1048576d:0.##} MB. Para restaurar, use a Lixeira do Windows.", "Enviar à Lixeira", () => Task.CompletedTask, 700, danger: true);
        foreach (var entry in plan.Items("entries"))
            dialog.Body.Children.Add(Ui.Stack(Ui.Text(entry.S("name"), bold: true), Ui.Text(entry.S("path"), TextRole.Caption, true)));
        if (!Dialog(dialog))
            return;
        await AfterOperation(await Client.Recycle(plan!.S("id")), "enviados à Lixeira");
    }
}
