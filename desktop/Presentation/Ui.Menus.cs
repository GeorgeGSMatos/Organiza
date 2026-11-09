using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;

namespace Organiza.Wpf.Presentation;

public sealed record FlyoutAction(string Label, Action Action, AppIcon Icon, bool Danger = false);

public static partial class Ui
{
    public static Popup Flyout(Button anchor, IEnumerable<(string Label, Action Action)> actions) =>
        Flyout(anchor, actions.Select(action => new FlyoutAction(action.Label, action.Action, AppIcon.Info)), false);

    public static Popup Flyout(Button anchor, IEnumerable<FlyoutAction> actions, bool integrated)
    {
        var list = new StackPanel();
        var surface = new Border { Child = list, Padding = DesignResources.Spacing("FlyoutPadding"), CornerRadius = (CornerRadius)Application.Current.FindResource("FlyoutCorner"), BorderThickness = DesignResources.Spacing("BorderThin"), MinWidth = DesignResources.Number("FlyoutMinWidth") };
        surface.SetResourceReference(Border.BackgroundProperty, "ShadeSolidSurfaceBrush");
        surface.SetResourceReference(Border.BorderBrushProperty, "ShadeBorderBrush");
        if (!integrated)
            Material.SetFloating(surface, true);
        var popup = new Popup { Child = surface, PlacementTarget = anchor, Placement = PlacementMode.Bottom, StaysOpen = false, AllowsTransparency = integrated };
        foreach (var action in actions)
        {
            var button = Button(action.Label, () => { popup.IsOpen = false; action.Action(); });
            button.Style = Style(integrated ? action.Danger ? "DangerMenuActionButton" : "MenuActionButton" : "IconButton");
            if (integrated)
            {
                var glyph = Glyph(action.Icon);
                glyph.ClearValue(TextBlock.ForegroundProperty);
                glyph.Margin = DesignResources.Spacing("LeadingIconMargin");
                button.Content = IconContent(glyph, new TextBlock { Text = action.Label, VerticalAlignment = VerticalAlignment.Center });
            }
            button.HorizontalAlignment = HorizontalAlignment.Stretch;
            button.HorizontalContentAlignment = HorizontalAlignment.Left;
            if (integrated && action.Danger && list.Children.Count > 0)
            {
                var divider = Divider();
                divider.Margin = DesignResources.Spacing("MenuDividerMargin");
                list.Children.Add(divider);
            }
            if (!integrated)
            {
                button.Margin = new Thickness(0);
                button.Padding = DesignResources.Spacing("FlyoutItemPadding");
            }
            list.Children.Add(button);
        }
        surface.PreviewKeyDown += (_, e) =>
        {
            var buttons = list.Children.OfType<Button>().ToList();
            var current = buttons.IndexOf(Keyboard.FocusedElement as Button ?? buttons[0]);
            if (e.Key == Key.Escape)
            {
                popup.IsOpen = false;
                e.Handled = true;
            }
            else if (e.Key is Key.Down or Key.Up or Key.Home or Key.End)
            {
                var index = e.Key == Key.Home ? 0 : e.Key == Key.End ? buttons.Count - 1 : (current + (e.Key == Key.Down ? 1 : buttons.Count - 1)) % buttons.Count;
                buttons[index].Focus();
                e.Handled = true;
            }
        };
        if (integrated)
        {
            surface.MinWidth = DesignResources.Number("OverviewFlyoutMinWidth");
            surface.Padding = DesignResources.Spacing("MenuSurfacePadding");
            surface.CornerRadius = (CornerRadius)Application.Current.FindResource("CardCorner");
            Material.ApplyTransparentMenu(surface);
            UiMotion.SetScope(surface, true);
        }
        popup.Opened += (_, _) =>
        {
            list.Children.OfType<Button>().FirstOrDefault()?.Focus();
            if (integrated)
                surface.Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Loaded, new Action(() =>
            {
                if (!popup.IsOpen)
                    return;
                Material.ApplyTransparentMenu(surface);
                UiMotion.Enter(surface, dialog: true);
            }));
        };
        popup.Closed += (_, _) => anchor.Focus();
        return popup;
    }
    internal static void IntegrateDropdown(ComboBox choice)
    {
        Border? surface = null;
        choice.Loaded += (_, _) =>
        {
            choice.ApplyTemplate();
            if (choice.Template.FindName("PART_Popup", choice) is not System.Windows.Controls.Primitives.Popup popup || popup.Child is not Border border)
                throw new InvalidOperationException("O seletor de pastas exige um Popup com superfície própria.");
            // Prepare alpha before the popup creates its native window.
            popup.AllowsTransparency = true;
            surface = border;
            Material.SetFloating(surface, false);
            Material.ApplyTransparentMenu(surface);
            surface.SetResourceReference(Border.PaddingProperty, "MenuSurfacePadding");
            surface.SetResourceReference(Border.CornerRadiusProperty, "CardCorner");
            surface.SetResourceReference(System.Windows.Documents.TextElement.FontFamilyProperty, "ShadeFont");
            UiMotion.SetScope(surface, true);
        };
        choice.DropDownOpened += (_, _) => choice.Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Loaded, new Action(() =>
        {
            if (!choice.IsDropDownOpen || surface is null)
                return;
            Material.ApplyTransparentMenu(surface);
            UiMotion.Enter(surface, dialog: true);
        }));
    }

}
