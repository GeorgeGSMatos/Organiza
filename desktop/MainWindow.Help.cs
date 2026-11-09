using System.Windows;
using Organiza.Wpf.Navigation;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private void HelpClick(object sender, RoutedEventArgs args) => Execute(ShowHelp);

    private Task ShowHelp()
    {
        var tips = _navigation.Page switch
        {
            AppPage.Folders => new[]
            {
                (AppIcon.Search, "Confira os arquivos", "Ao abrir ou selecionar uma pasta, a análise carrega os arquivos, destinos e sugestões. Analisar atualiza a lista sem mover arquivos."),
                (AppIcon.Activity, "Escolha o modo", "A alavanca alterna Manual e Automática. O modo fica salvo por pasta e é retomado ao iniciar; os avisos explicam quando uma pasta precisa de atenção."),
                (AppIcon.Check, "Organize com controle", "Selecione arquivos e confira a confirmação. Operações manuais suspendem a automação durante a revisão, preservando o modo escolhido."),
                (AppIcon.Trash, "Use a Lixeira", "A lixeira vermelha solicita envio à Lixeira do Windows. Restaurar um arquivo reciclado é feito pela própria Lixeira.")
            },
            AppPage.Rules => new[]
            {
                (AppIcon.Folder, "Escolha a pasta", "Cada pasta tem suas próprias regras."),
                (AppIcon.Rules, "Condições e destino", "Crie uma regra ou use categorias sugeridas. Use o lápis para editar condições e destino; o escudo abre Exceções e revisão."),
                (AppIcon.Check, "Revise antes de organizar", "Se várias regras corresponderem, escolha uma na análise. Pausar ou remover uma regra preserva os arquivos.")
            },
            AppPage.History => new[]
            {
                (AppIcon.Search, "Encontre uma operação", "Use a busca, o período e a pasta. Os filtros alteram apenas a visualização."),
                (AppIcon.Folder, "Pasta e Lixeira", "O ícone de pasta abre o local do arquivo. A Lixeira vermelha abre a Lixeira do Windows."),
                (AppIcon.Undo, "Desfazer ou conferir", "A seta permite desfazer uma movimentação elegível. Para restaurar um arquivo reciclado, use a Lixeira do Windows. O ícone de informação mostra detalhes de uma falha.")
            },
            AppPage.Settings => new[]
            {
                (AppIcon.Settings, "Preferências", "As alterações são salvas automaticamente. Remover um cadastro não apaga a pasta do disco."),
                (AppIcon.Device, "Dados locais", "Pastas, regras e histórico ficam neste computador. O botão de pasta abre o local desses dados."),
                (AppIcon.Power, "Iniciar com o Windows", "Ao entrar na conta, o aplicativo pode iniciar na bandeja. A organização respeita o modo salvo em cada pasta."),
                (AppIcon.Info, "Sobre o Organiza", "Versão, autoria e licença ficam ao final de Configurações. Informações e diagnóstico reúne os dados para suporte.")
            },
            _ => new[]
            {
                (AppIcon.Folder, "Abra uma pasta", "Clique em um cartão ou escolha uma pasta no seletor de Pastas."),
                (AppIcon.Search, "Analise e selecione", "Analisar não move arquivos. Confira os destinos e use Revisar para decidir os itens sem regra."),
                (AppIcon.Archive, "Organize ou envie à Lixeira", "Marque os arquivos e escolha uma ação. Você confirma o lote antes de qualquer alteração."),
                (AppIcon.Activity, "Organização automática", "As pastas são analisadas ao abrir. Ative a alavanca na pasta ou na Visão geral para organizar automaticamente. O modo escolhido fica salvo e é retomado ao iniciar. O X mantém o aplicativo na bandeja.")
            }
        };
        var dialog = new UiDialog(this, "Ajuda · " + AppPages.Get(_navigation.Page).Title, "Veja como usar os recursos desta tela.", "Entendi", () => Task.CompletedTask, informational: true, integrated: true, headingIcon: AppIcon.Help);
        dialog.Save.Style = Ui.Style("PrimaryButton");
        foreach (var (icon, title, body) in tips)
        {
            var glyph = Ui.Glyph(icon);
            glyph.Margin = DesignResources.Spacing("HelpTopicIconMargin");
            glyph.VerticalAlignment = VerticalAlignment.Top;
            var heading = Ui.Text(title, TextRole.Label, bold: true);
            var description = Ui.Text(body, TextRole.Body, muted: true);
            description.Margin = DesignResources.Spacing("HelpTopicTextMargin");
            var topic = Ui.IconContent(glyph, Ui.Stack(heading, description));
            topic.Margin = DesignResources.Spacing("HelpTopicMargin");
            dialog.Body.Children.Add(topic);
        }
        Dialog(dialog);
        return Task.CompletedTask;
    }
}
