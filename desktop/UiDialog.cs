using Organiza.Wpf.Presentation;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Shell;

namespace Organiza.Wpf;

/// <summary>Shared modal shell. Pages supply fields; chrome, actions and validation stay here.</summary>
public sealed class UiDialog : Window
{
    private bool _saving;
    public StackPanel Body { get; } = new();
    public Button Save
    {
        get;
    }
    public TextBlock Error { get; } = Ui.Text("", TextRole.Caption);

    public UiDialog(Window owner, string title, string description, string saveLabel, Func<Task> submit,
        double? width = null, bool danger = false, bool informational = false, bool integrated = false, AppIcon? headingIcon = null)
    {
        Title = title;
        Owner = owner;
        Icon = owner.Icon;
        ShowInTaskbar = false;
        var screenMargin = DesignResources.Number("DialogScreenMargin");
        Width = Math.Min(width ?? DesignResources.Number("DialogWidth"), SystemParameters.WorkArea.Width - screenMargin);
        MaxHeight = Math.Max(DesignResources.Number("DialogMinHeight"), SystemParameters.WorkArea.Height - screenMargin);
        SizeToContent = SizeToContent.Height;
        ResizeMode = ResizeMode.NoResize;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        Style = (Style)Application.Current.FindResource(typeof(Window));
        WindowChrome.SetWindowChrome(this, new WindowChrome
        {
            CaptionHeight = DesignResources.Number("DialogCaptionHeight"),
            GlassFrameThickness = new Thickness(-1),
            ResizeBorderThickness = new Thickness(0),
            UseAeroCaptionButtons = true
        });
        UiMotion.SetScope(this, true);

        Error.SetResourceReference(TextBlock.ForegroundProperty, "ShadeErrorBrush");
        Error.Margin = DesignResources.Spacing("DialogErrorMargin");
        Error.Visibility = Visibility.Collapsed;
        AutomationProperties.SetName(Error, "Mensagem de validação");
        var cancel = Ui.Button("Cancelar", Close);
        cancel.IsCancel = true;
        cancel.Margin = DesignResources.Spacing("DialogCancelMargin");
        cancel.Visibility = informational ? Visibility.Collapsed : Visibility.Visible;
        Save = Ui.Button(saveLabel, async () =>
        {
            if (_saving)
                return;
            _saving = true;
            Save!.IsEnabled = cancel.IsEnabled = false;
            Error.Text = "";
            Error.Visibility = Visibility.Collapsed;
            try
            {
                await submit();
                DialogResult = true;
            }
            catch (Exception error)
            {
                Error.Text = error.Message;
                Error.Visibility = Visibility.Visible;
            }
            finally { _saving = false; Save.IsEnabled = cancel.IsEnabled = true; }
        }, primary: !danger && !informational, danger: danger);
        Save.IsDefault = true;
        if (danger)
        {
            var trash = Ui.Glyph(AppIcon.Trash);
            trash.Margin = DesignResources.Spacing("LeadingIconMargin");
            Save.Content = Ui.IconContent(trash, new TextBlock { Text = saveLabel, VerticalAlignment = VerticalAlignment.Center });
        }
        Save.IsCancel = informational;
        Save.Margin = new Thickness(0);

        var layout = new DockPanel { LastChildFill = true };
        var caption = CreateCaption();
        DockPanel.SetDock(caption, Dock.Top);
        layout.Children.Add(caption);
        var footer = CreateFooter(cancel);
        DockPanel.SetDock(footer, Dock.Bottom);
        layout.Children.Add(footer);
        var titleText = Ui.Text(title, TextRole.DialogTitle, bold: true);
        var heading = new StackPanel();
        if (headingIcon is { } icon)
        {
            var glyph = Ui.Glyph(icon, large: true);
            glyph.Margin = DesignResources.Spacing("LeadingIconMargin");
            heading.Children.Add(Ui.IconContent(glyph, titleText));
        }
        else
            heading.Children.Add(titleText);
        if (!string.IsNullOrWhiteSpace(description))
        {
            var hint = Ui.Text(description, TextRole.Body, muted: true);
            hint.Margin = DesignResources.Spacing("DialogDescriptionMargin");
            heading.Children.Add(hint);
        }
        heading.Margin = DesignResources.Spacing("DialogHeadingMargin");
        DockPanel.SetDock(heading, Dock.Top);
        layout.Children.Add(heading);
        layout.Children.Add(new ScrollViewer
        {
            Content = Body,
            Margin = DesignResources.Spacing("DialogBodyMargin"),
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            MaxHeight = Math.Max(DesignResources.Number("DialogBodyMinHeight"), MaxHeight - DesignResources.Number("DialogReservedHeight"))
        });
        Content = layout;
        Loaded += (_, _) =>
        {
            if (integrated)
                Material.ApplyTransient(this);
            else
                Material.Apply(this);
        };
        Closing += (_, e) => { if (_saving && DialogResult != true) e.Cancel = true; };
    }

    private static Border CreateCaption()
    {
        var label = Ui.Text("Organiza", TextRole.Label, bold: true);
        var caption = new Border
        {
            Height = DesignResources.Number("DialogCaptionHeight"),
            Padding = DesignResources.Spacing("DialogCaptionPadding"),
            BorderThickness = new Thickness(0, 0, 0, 1),
            Child = label
        };
        label.VerticalAlignment = VerticalAlignment.Center;
        caption.SetResourceReference(Border.BorderBrushProperty, "ShadeBorderBrush");
        return caption;
    }

    private Border CreateFooter(Button cancel)
    {
        var actions = Ui.Inline(cancel, Save);
        actions.HorizontalAlignment = HorizontalAlignment.Right;
        var footer = new Border
        {
            Padding = DesignResources.Spacing("DialogFooterPadding"),
            BorderThickness = new Thickness(0, 1, 0, 0),
            Child = Ui.Stack(Error, actions)
        };
        footer.SetResourceReference(Border.BorderBrushProperty, "ShadeBorderBrush");
        footer.SetResourceReference(Border.BackgroundProperty, "ShadeSurfaceBrush");
        return footer;
    }
}
