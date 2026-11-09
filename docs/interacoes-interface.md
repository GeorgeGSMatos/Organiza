# Estados de interação

Os estilos compartilhados definem os estados das cinco telas, da lista de arquivos
e dos diálogos. Cartões de pasta clicáveis recebem contorno branco suave; cartões
informativos de regras e configurações mantêm seu fundo, com resposta nos controles.

Botões secundários e de ícone usam iluminação neutra. Botões principais preservam
o azul e recebem uma iluminação mais perceptível. O pressionamento escurece a
superfície sem deslocar o conteúdo. Lixeiras e ações destrutivas usam iluminação
vermelha suave. Links clareiam e exibem sublinhado.

Campos e seletores mostram contorno neutro no hover e azul no foco. Abas e navegação
mantêm seleção distinta do hover. Linhas de arquivos e histórico têm iluminação
suave em toda a extensão; isso não torna a linha de histórico um botão. Seleções
de arquivos continuam tendo prioridade sobre o hover.

Interruptores realçam seu contorno mantendo o estado ligado ou desligado legível.
Menus usam a mesma iluminação neutra, e as opções selecionadas dos seletores têm
fundo de seleção. O foco por teclado continua usando o contorno compartilhado.

As transições de opacidade de botões, cartões, links, abas, navegação e interruptores
usam `UiMotion.HoverMilliseconds` (150 ms). Campos, menus e linhas respondem
imediatamente. A redução de movimento elimina a animação e preserva a resposta
visual. Controles desabilitados não recebem hover; desabilitar um botão ou retirar
o componente da tela também limpa o destaque anterior.

As cores de contorno e preenchimento neutros ficam na paleta e são resolvidas pelo
ThemeService, incluindo as cores do sistema em alto contraste. Variações de botão
ficam nos estilos PrimaryButton, SecondaryButton, DangerButton e DangerIconButton.

Os templates de entrada deixam o espaçamento de edição a cargo do TextBox,
sem replicar Padding como margem do PART_ContentHost. Campos de uma linha
centralizam o conteúdo verticalmente, incluindo os compactos de 32 px. O texto
de exemplo acompanha esse alinhamento; campos que aceitam múltiplas linhas
mantêm o alinhamento padrão no topo.

## Diálogos

A ajuda usa o material transitório nativo do Windows, título com ícone e tópicos
com ícones e tipografia compartilhados. Seu conteúdo acompanha a página atual,
com texto de leitura em tamanho normal e ação única Entendi no rodapé. Os
espaçamentos específicos ficam nos tokens HelpTopic*.

UiDialog centraliza a moldura com identificação do Organiza, título e descrição,
conteúdo com rolagem e rodapé fixo de ações. Usa os mesmos campos, efeitos e
material da janela principal. Dimensões e espaçamentos ficam nos tokens Dialog*.
As janelas abrem centralizadas no aplicativo e não criam outro botão na barra de tarefas.

Formulários usam Cancelar e uma ação principal azul. Confirmações de remoção ou
envio à Lixeira usam uma ação vermelha. Ajuda e detalhes usam apenas uma ação de
fechamento. Erros aparecem no rodapé e a janela impede o fechamento durante o
envio dos dados. O seletor de pastas continua sendo o diálogo nativo do Windows.

## Ajustes específicos da Visão geral

A última atividade apresenta o nome em uma linha e status/data abaixo. A ação
Ver histórico fica à direita, com espaço próprio e ícone. A data relativa mostra
o horário completo na dica ao passar o mouse.

O menu de opções de pasta usa ícones e destaque vermelho para remover o cadastro.
Sua superfície tem escopo de animação próprio, pois Popup não pertence à árvore
visual da janela principal. Os botões recebem as transições compartilhadas.

Adicionar/editar pasta a partir da Visão geral usa ícone no título, campos com
superfície leve e botão de escolha com ícone. Esse diálogo solicita acrílico
transitório ao Windows 11. O menu usa transparência por pixel com uma tonalidade
cinza escura, sem depender do acrílico nativo no Popup. Essa transparência não
implementa desfoque próprio. O menu inclui separador antes da remoção e estilos
próprios para os itens. Com transparência desativada ou alto contraste, o fundo
permanece sólido e legível. O resultado visual do material,
incluindo a interação com Windhawk, requer inspeção no Windows do usuário.
Essas opções são ativadas apenas a partir da Visão geral.

## Ajustes específicos de Pastas

A confirmação de organização automática usa o material transitório nativo,
ícone de atividade no título e a ação Ativar. O seletor Pasta atual usa uma
lista com transparência por pixel, tonalidade escura, cantos e transição do
mesmo padrão do menu da Visão geral. O preparo da transparência ocorre antes
da criação da janela do Popup. Alto contraste e transparência desativada
mantêm o fundo sólido. O painel de detalhes do arquivo permanece ao lado
da tabela, com destino, sugestões e metadados do arquivo selecionado.

O conteúdo desse painel está em MainWindow.FileDetails.cs: nome com quebra de
linha e ícone, situação, destino ou sugestão, ações alinhadas com a mesma largura
e informações de tipo/tamanho em duas colunas. Os caminhos completos ficam em
uma seção expansível. Os espaçamentos usam tokens FileDetail*. O cartão se alinha
ao topo da tabela e continua aparecendo abaixo dela quando falta largura.

## Regras

O seletor de pastas e os seletores de nova/editar regra usam o mesmo menu
translúcido de Pastas. Exceções e revisão usa ícone de escudo e rótulo visível.
Seus diálogos usam o material transitório e os campos com superfície leve.

Nova regra e Editar regra compartilham o formulário, organizado em condições,
destino e opções avançadas. Ação e escopo ficam nas opções avançadas, expandidas
automaticamente quando seus valores diferem de Organizar/Seguir configuração
da pasta. Exceções separa itens ignorados de revisão e estabilidade. Os dois
formulários usam Salvar e Cancelar, mantendo os parâmetros e validações existentes.

Campos de regra e seletores têm 32 px de altura, com espaçamento interno próprio;
as listas de exceções usam 96 px e rolagem. A remoção de condição fica no ícone
de lixeira vermelho ao lado do seletor; confirmações destrutivas também exibem
a lixeira no botão de ação. As condições mostram exemplos conforme seu tipo e
a orientação de destino muda entre subpasta e caminho completo. Esses padrões
ficam nos estilos CompactTextInput, MultilineTextInput e CompactChoice.

## Histórico

Busca e filtros usam altura compacta de 32 px. Os seletores usam a superfície
translúcida e a transição dos menus de Pastas. Os filtros podem quebrar de linha
em larguras menores mantendo o espaçamento. A coluna Pasta começa mais à direita,
com proporções compartilhadas entre cabeçalho e registros. A paginação usa três
colunas automáticas, contador sem quebra de linha e setas centralizadas.
