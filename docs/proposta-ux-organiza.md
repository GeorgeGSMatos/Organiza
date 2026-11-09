# Proposta de experiência de uso — Organiza

27/10/2026 · Proposta para avaliação. Nenhuma alteração funcional ou visual foi aplicada ao aplicativo nesta etapa.

## Direção

Preservar a identidade visual aprovada e reorganizar a experiência em torno da pasta escolhida. A interface deve deixar claro onde o usuário está, o que pode fazer e qual será o resultado de cada ação. Configurações avançadas continuam disponíveis, mas aparecem quando necessárias.

Fluxo principal proposto:

**Abrir uma pasta → Analisar arquivos → Selecionar → Organizar ou enviar à Lixeira → Continuar na mesma pasta.**

O Histórico continua sendo um destino voluntário na navegação lateral.

## Evidência da versão atual

Foram examinadas as duas imagens fornecidas e os arquivos atuais em `desktop` e `src/main`.

- A primeira imagem mostra um seletor opaco sobre o fundo translúcido. Em `desktop/Styles/Controls.xaml`, tanto o campo ComboBox quanto a superfície do Popup usam `ShadeSolidSurfaceBrush`.
- A segunda imagem mostra a faixa clara e o acabamento inconsistente do menu dos três pontos. Em `desktop/Styles/Native.xaml`, ContextMenu/MenuItem recebem cores, mas mantêm o modelo visual padrão. A proposta deve tratar o componente completo, incluindo a região de ícones.
- `MainWindow.Views.cs` coloca pastas e prévia na Visão geral. O cartão não é o acesso principal à pasta; o botão interno leva diretamente a Regras.
- `MainWindow.Preview.cs` redireciona para Histórico após organizar. `MainWindow.Dialogs.cs` faz o mesmo após enviar à Lixeira.
- A lista tem checkboxes, mas a reciclagem está ligada aos grupos de sugestões. `src/main/trash.cjs` utiliza a seleção de `ReviewService.rows`, limitada a arquivos sem regra de uma mesma pasta. A ação de Lixeira em lote precisa de adaptação no fluxo e no contrato do motor.
- A análise atual informa itens visitados e arquivos encontrados, sem total definitivo no início. Uma porcentagem real requer separar a descoberta dos arquivos da etapa com total conhecido.
- Regras são renderizadas em sequência vertical. Configurações e rodapé exibem informações redundantes de aparência e a palavra WPF.

## 1. Visão geral como ponto de partida

Retirar a prévia de arquivos e o seletor “Todas as pastas” da Visão geral. Essa tela passa a apresentar:

- Um resumo curto: pastas monitoradas e itens para revisar, quando houver uma análise válida que permita informar essa quantidade.
- Acesso às pastas recentes ou favoritas, com cartões clicáveis.
- Uma ação principal “Adicionar pasta” e um acesso “Ver todas” para Pastas.
- Situações que exigem atenção, somente quando existirem.

Sem tabela de arquivos, grandes blocos explicativos ou uma segunda cópia completa da tela Pastas. Quantidades não conhecidas aparecem como “Não analisada”, e não como zero. Contagens de análises anteriores precisam indicar sua origem/atualidade; a tela inicial não inicia uma varredura apenas para preencher números.

## 2. Pasta clicável e destino coerente

Manter as cinco áreas principais: Visão geral, Pastas, Regras, Histórico e Configurações.

Um clique no corpo do cartão abre **a área de trabalho daquela pasta dentro de Pastas**. Por exemplo:

**Downloads**

`← Pastas` · caminho abreviado · estado da organização automática

`Analisar arquivos` · `Regras` · `Abrir no Explorador`

A lista de arquivos fica nessa área. O usuário não precisa escolher novamente uma pasta que acabou de abrir. “Regras” leva à tela existente com essa pasta já selecionada. Voltar retorna à lista de pastas; voltar de Regras pode retornar à pasta de origem com o contexto preservado.

O cartão exibe somente nome, caminho em uma linha e estado útil. O caminho completo fica acessível em dica/detalhe. A disponibilidade da unidade e a ativação da automação não devem ser confundidas.

Os três pontos passam a conter apenas ações secundárias:

- Editar pasta.
- Abrir no Explorador.
- Remover do Organiza.

“Remover do Organiza” continua removendo o cadastro, não a pasta do disco. Clique nos três pontos não dispara a abertura do cartão. O cartão também deve funcionar pelo teclado.

Ativar/pausar a organização automática fica visível no contexto da pasta. Quando faltar uma regra ou uma análise revisada, uma orientação curta junto à ação leva ao próximo passo correto. Isso não ativa automação implicitamente nem elimina a revisão necessária.

## 3. Análise e revisão com menos passos

O trabalho deixa de depender do conceito de uma “prévia” genérica na tela inicial. Dentro da pasta, a sequência é explícita:

1. Analisar arquivos.
2. Conferir a lista e filtrar o que interessa.
3. Selecionar arquivos e escolher uma ação.
4. Confirmar quando houver movimentação ou envio à Lixeira.

A lista reúne arquivos classificados e sem regra. Filtros curtos com contagens: **Todos**, **Prontos**, **Revisar** e **Ignorados**. Conflitos podem ser destacados dentro de Revisar, com um filtro adicional quando existirem.

Sugestões deixam de formar uma parede de cartões acima da lista. Selecionar um arquivo/grupo sem destino abre um painel lateral com a sugestão, a justificativa curta e as opções de criar categoria, usar uma existente ou manter onde está. Condições avançadas e explicações completas ficam em detalhes expansíveis.

Quando não houver regra, apresentar uma escolha útil: “Usar categorias sugeridas” ou “Criar regra”. A adição de categorias continua explícita e não movimenta arquivos por si só.

## 4. Seleção em lote e continuidade

Uma seleção consistente por checkbox serve às ações sobre arquivos elegíveis da pasta, inclusive formatos diferentes. Não limitar a Lixeira a um cartão de sugestão nem exigir repetir uma confirmação por categoria.

Ao selecionar, aparece uma barra contextual, por exemplo:

**12 selecionados** · Organizar · Definir categoria · ícone de Lixeira · Limpar

- Cabeçalho permite selecionar os itens do filtro atual, com escopo explícito.
- Se houver selecionados fora do filtro, informar essa quantidade antes de agir.
- Trocar de pasta limpa a seleção, evitando aplicar uma ação na pasta errada.
- Organizar informa quais itens ainda precisam de destino; não escolhe regras ambíguas silenciosamente.
- Enviar à Lixeira funciona com uma seleção elegível de formatos diferentes e mantém confirmação com quantidade, tamanho e relação dos arquivos.
- Arquivos protegidos, em uso, alterados ou indisponíveis continuam sendo tratados com as verificações apropriadas. A interface explica impedimentos junto aos itens.

Depois de organizar ou reciclar:

- Permanecer na pasta atual.
- Atualizar a lista e os resultados de forma compatível com uma nova prévia válida.
- Preservar filtro, ordenação e posição de rolagem sempre que possível.
- Remover da seleção os itens concluídos; manter falhas visíveis e identificáveis.
- Exibir uma confirmação breve, como “12 arquivos enviados à Lixeira”.

O Histórico é registrado normalmente, mas não é aberto automaticamente. Desfazer continua disponível onde houver suporte; restauração de itens da Lixeira continua sendo feita pela Lixeira do Windows. Não introduzir exclusão permanente ou descarte automático.

## 5. Progresso com porcentagem útil

Representar o trabalho por fases, mantendo o progresso próximo à lista:

- **Localizando arquivos…** enquanto o total ainda não for conhecido.
- **Analisando · 42% · 84 de 200 arquivos**, quando houver total válido.
- **Organizando · 60% · 18 de 30 arquivos** durante uma seleção confirmada.
- **Enviando à Lixeira · 60% · 18 de 30 arquivos** no lote manual.

Porcentagem baseada em contagem de arquivos, não em uma promessa de tempo restante. Um arquivo grande pode consumir mais tempo que vários pequenos. Não avançar uma porcentagem artificial apenas pelo tempo decorrido.

Uma análise parcial/cancelada não aparece como “100% concluída”. Alterações de arquivos durante o processo precisam ser tratadas sem esconder que o resultado é parcial. O resumo final separa prontos, revisar e ignorados; “80% prontos” é classificação do resultado, não progresso da operação.

Cancelar análise e parar após o arquivo atual ficam no mesmo local do progresso, com rótulo/dica correspondente à fase.

## 6. Menus e dropdowns com o mesmo acabamento

Criar um padrão único de superfícies flutuantes para todas as telas:

- Campo fechado com superfície translúcida.
- Lista aberta com o mesmo material e contraste apropriado.
- Menu dos três pontos com o mesmo padrão, sem a faixa branca e sem espaços de ícones vazios.
- Hover, seleção, foco de teclado, bordas e animação consistentes.

A revisão inclui seletores de pasta, filtros, condições, tipos de arquivo, categorias, destinos e diálogos. Não basta mudar a cor do seletor que aparece na Visão geral.

Se uma lista usar uma janela separada, será necessário preparar seu próprio fundo, ou utilizar um painel na janela principal quando isso preservar bem a interação. Transparência de cor sozinha não comprova desfoque do desktop. A implementação deve ser verificada no Windows com o Translucent Windows ativo e manter uma superfície legível quando o efeito estiver indisponível/alto contraste.

## 7. Regras em duas colunas

Exibir duas regras por linha quando houver largura suficiente, com uma coluna em janelas menores ou quando a escala de texto exigir.

Cada cartão mostra nome, estado, resumo curto das condições e destino. Ícones de editar/remover ficam discretos; o switch de ativação fica em posição consistente. Condições completas, exceções e opções avançadas ficam no editor/detalhe. Não truncar uma informação essencial sem oferecer acesso ao valor completo.

A pasta selecionada é preservada ao chegar da sua área de trabalho. Voltar retorna ao contexto correto. “Adicionar sugestões” não deve competir visualmente com as regras já existentes.

## 8. Menos texto, ícones e animações funcionais

Usar ícones familiares para editar, atualizar, abrir no Explorador, pausar/retomar, excluir cadastro e enviar à Lixeira. Todos têm dica, nome acessível e foco visível.

Manter texto curto nas ações principais — “Adicionar pasta”, “Analisar” e “Organizar” — para que a primeira utilização seja compreensível. Substituir explicações repetidas por dicas contextuais e detalhes expansíveis. Confirmações importantes continuam claras.

Animações curtas indicam ação: atualizar durante a análise, transição de play/pause, resposta ao selecionar e confirmação ao concluir. Não manter ícones girando ou pulsando em repouso. Respeitar redução de movimento e alto contraste. O efeito visual nunca deve indicar sucesso antes de a operação ser confirmada.

Eliminar textos técnicos e redundâncias: “WPF” sai do rodapé, Sobre e descrições. A versão aparece somente em Sobre. A barra inferior é reservada a estado/progresso realmente úteis, não a frases permanentes repetidas.

## 9. Configurações objetivas

Remover a seção que apenas informa “Tema escuro” e o texto sobre material/WPF. Manter escolhas reais:

- Iniciar com o Windows.
- Visualização compacta.
- Confirmar ao remover pastas do cadastro.
- Sobre, com versão e informações essenciais.

Não criar um seletor de tema quando existe apenas uma aparência. Preferências avançadas de organização continuam no contexto da pasta/regra, não misturadas com configurações gerais.

## Organização da implementação futura

1. **Componentes comuns:** menus/dropdowns, ícones, foco, tooltips, superfícies e retirada de textos técnicos.
2. **Navegação e páginas:** nova Visão geral, cartões clicáveis e área de trabalho por pasta; Regras em duas colunas e Configurações reduzidas.
3. **Operações:** seleção em lote, confirmação única adequada, permanência na pasta, atualização da lista e progresso por fase.
4. **Validação:** executar cenários reais do início ao fim e comparar o efeito nas superfícies fechadas/abertas no Windows.

O núcleo de validação das operações deve ser reaproveitado. A Lixeira precisa ampliar a seleção aceita pelo motor sem reutilizar indevidamente a restrição atual de arquivos sem regra. Prévia e confirmações continuam vinculadas a metadados e revisões válidas; uma lista visual atualizada não pode continuar usando tokens expirados.

## Critérios de aceite da proposta para implementação

- A Visão geral não contém a tabela de prévia nem exige escolher “Todas as pastas”.
- Clicar no cartão abre aquela pasta dentro do app; os três pontos abrem somente o menu secundário, sem faixa clara.
- Ações levam a destinos coerentes e preservam a pasta selecionada.
- Menus e dropdowns de todas as telas compartilham o acabamento translúcido, incluindo listas abertas, com fallback legível.
- É possível selecionar arquivos de formatos diferentes na pasta e enviá-los à Lixeira com uma única confirmação adequada.
- Organizar e reciclar não redirecionam ao Histórico; a lista permanece utilizável após cada lote.
- Progresso mostra porcentagem quando o total é conhecido e sinaliza honestamente descoberta, cancelamento e resultados parciais.
- Regras aparecem em duas colunas quando cabem e não cortam controles em janela menor/escala maior.
- Ações secundárias usam ícones acessíveis; ações principais continuam identificáveis.
- Textos recorrentes e explicações extensas saem do fluxo principal; ajuda e confirmações aparecem no contexto.
- Configurações não exibe escolha/descrição redundante de tema único. A interface não exibe “WPF”.
- Pastas, regras, histórico e proteções de arquivos continuam preservados.

Esta entrega é a proposta de experiência. Alterações de interface, motor e pacotes dependem da etapa de implementação.
