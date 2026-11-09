using Organiza.Wpf.Navigation;
using Organiza.Wpf.Services;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;

namespace Organiza.Wpf.Presentation;

public sealed class PreviewItem(JsonNode source) : INotifyPropertyChanged
{
    public JsonNode Source { get; } = source;
    public string Id => Source.S("id");
    public string Name => Source.S("name");
    public string Path => Source.S("folderName") + " · " + Source.S("relativePath");
    public string Type => Source.S("type") switch { "document" => "Documento", "spreadsheet" => "Planilha", "image" => "Imagem", "video" => "Vídeo", "audio" => "Áudio", "archive" => "Compactado", "installer" => "Instalador", _ => "Outro" };
    public string Size
    {
        get
        {
            var size = Source.N("size");
            return size >= 1073741824 ? $"{size / 1073741824d:0.#} GB" : size >= 1048576 ? $"{size / 1048576d:0.#} MB" : size >= 1024 ? $"{size / 1024d:0.#} KB" : $"{size} B";
        }
    }
    public string Destination => Source.S("destination", "Sem destino definido");
    public long SizeBytes => Source.N("size");
    public string DestinationLabel
    {
        get
        {
            var destination = Source.S("destination");
            if (destination.Length == 0)
                return "Sem destino";
            var origin = Source.S("path");
            var relative = Source.S("relativePath");
            var folder = origin.Length >= relative.Length ? origin[..(origin.Length - relative.Length)] : "";
            var target = System.IO.Path.GetDirectoryName(destination) ?? destination;
            if (folder.Length == 0)
                return target;
            var label = System.IO.Path.GetRelativePath(folder, target);
            return label.StartsWith("..") || System.IO.Path.IsPathRooted(label) ? target : label;
        }
    }
    public string PresentationStatus => Failure.Length > 0 ? "failed" : Source.S("status");
    public string FileGlyph => AppIcons.Glyph(FilePresentation.TypeIcon(Source.S("type")));
    public StatusTone Tone => FilePresentation.DescribeStatus(PresentationStatus).Tone;
    public string StatusGlyph => AppIcons.Glyph(FilePresentation.StatusIcon(PresentationStatus));
    public string Failure { get; set; } = "";
    public string Reason => Failure.Length > 0 ? "Não concluído: " + Failure : Source.S("reason");
    public string Status => FilePresentation.StatusLabel(PresentationStatus);
    public bool CanMove => Source.S("status") != "ignored" && Source.S("ignoreReason").Length == 0 && Source.Items("candidates").Any() && (Source.Items("candidates").Count() == 1 || Source.S("selectedRuleId").Length > 0);
    private bool _selected;
    public Action? Updated
    {
        get; set;
    }
    public bool Selected
    {
        get => _selected; set
        {
            if (_selected == value)
                return;
            _selected = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Selected)));
            Updated?.Invoke();
        }
    }
    public event PropertyChangedEventHandler? PropertyChanged;
}
