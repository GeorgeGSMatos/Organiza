# Organiza — análise visual e proposta de adaptação ao ShadeFlow

Task 1 · 27/10/2026 · Proposta para aprovação antes da implementação.

## Resultado da análise

É possível dar aos dois aplicativos a mesma identidade visual na estrutura atual do Organiza. O ShadeFlow utiliza WPF/C#; o Organiza utiliza Electron/HTML/CSS. A proposta traduz seus componentes visuais para a interface existente, sem portar o aplicativo para WPF.

O conjunto que identifica o ShadeFlow é: fundo grafite frio uniforme, cartões discretamente elevados por cor e borda, azul claro, texto Segoe, ícones monocromáticos, navegação compacta com indicador lateral e controles de cantos moderadamente arredondados. O Organiza atual tem marca grande na lateral, gradientes, azul saturado, títulos grandes e cartões mais espaçosos. Esses são os principais pontos da adaptação.

## Evidências examinadas

Referências do ShadeFlow em `/home/seu-usuario/dev/ShadeFlow`:

- `Services/ThemeService.cs`: cores claras/escuras, transparências, destaque derivado da cor do Windows e tratamento de alto contraste.
- `Styles/Colors.xaml`: família Segoe e escala de espaçamento.
- `Styles/Controls.xaml`: tipografia, cartões, botões, campos, menus, switches, navegação, foco e rolagem.
- `MainWindow.xaml`: barra superior, navegação, páginas, cartões e distribuição das ações.
- `Views/PresetDialog.xaml` e `Views/QuickPanelWindow.xaml`: formulários e agrupamento de informações em espaços menores.
- Capturas existentes `artifacts/release-1.0.0/visual-results/Displays-dark.png` e `Preferences.png`.

As capturas são da versão 1.0.0; o código inspecionado se identifica como 1.1.2 e inclui Presets. Elas servem de referência visual, não de prova de toda a interface atual em execução. Não foi aberta uma sessão nativa do ShadeFlow no Windows nesta análise.

Referências do Organiza: `src/renderer/index.html`, `styles.css`, `app.js`, `rules-ui.js`, `operations-ui.js`, `review-ui.js`, tamanho da janela em `src/main/main.cjs` e captura entregue `Organiza-0.4.0-Sugestoes.png`.

## Paleta proposta

Os valores abaixo vêm do tema escuro do ShadeFlow. Transparências devem ser mantidas como camadas; sua aparência final depende da superfície abaixo.

| Uso | Valor de referência | Aplicação no Organiza |
| --- | --- | --- |
| Fundo principal | `#202127` | Janela e área de conteúdo, sem gradiente |
| Navegação | preto a 7,1% sobre o fundo | Lateral um pouco mais escura |
| Cartões | branco a 6,3% sobre o fundo | Aproximadamente `#2E2F35` no fundo principal |
| Superfície sólida | `#2D2F36` | Campos, menus e diálogos |
| Hover/seleção | branco a 18,8% | Estado local sobre a superfície do controle |
| Bordas | branco a 12,5% | Divisórias e contornos discretos |
| Texto principal | `#F7F7F8` | Títulos e conteúdo |
| Texto secundário | `#B8BAC3` | Caminhos, descrições e metadados |
| Destaque padrão | `#78B9FF` | Botão principal, foco, seleção e switches ativos |
| Texto sobre destaque | `#10151D` | Legenda escura no botão azul claro |
| Erro/ação destrutiva | `#FFB4AB` | Mensagens e ações de remoção/Lixeira |

O ShadeFlow pode substituir o azul padrão por um tom calculado a partir da cor de destaque do Windows. Por isso, o azul das capturas não precisa ser exatamente `#78B9FF`. Recomenda-se usar inicialmente o azul padrão fixo no Organiza; acompanhar a cor do sistema e oferecer tema claro ficam fora desta mudança visual.

As cores de sucesso, atenção e conflito continuam com significado próprio no Organiza. Os estados devem ter rótulo e ícone, e não depender apenas da cor. Superfícies permanecem neutras: evitar grandes blocos azuis para avisos e sugestões.

## Medidas e componentes

| Elemento | Referência ShadeFlow | Adaptação proposta |
| --- | --- | --- |
| Fonte | Segoe UI Variable, Segoe UI | Mesma família com fallback existente |
| Texto padrão | 13 px | 13–14 px; caminhos e tabelas com pelo menos 12 px |
| Título da página | 28 px, semibold | 28 px, sem crescer exageradamente em janelas grandes |
| Título de seção | 16 px, semibold | Mesmo padrão |
| Barra superior | 46 px | Logo pequeno + Organiza à esquerda; controles da janela à direita |
| Lateral | 184 px | 200 px iniciais para os rótulos do Organiza |
| Item de navegação | 42 px, raio 7 px | Mesma altura e marcador azul de 3 × 19 px |
| Cartão | raio 11 px, padding 18 px | Mesmo padrão |
| Botões | mínimo 34 px, raio 7 px | 34–36 px; ícones com nome acessível |
| Campos | mínimo 34–36 px, raio 6 px | Mesmo padrão, foco azul visível |
| Switch | 40 × 22 px | Mesmo padrão |
| Ícones de navegação | 18 px monocromáticos | Mesma linguagem e peso visual |
| Espaços | 4, 8, 12, 16 px | Escala comum; 24–28 px entre grupos maiores |

Os ícones funcionais podem continuar em SVG, ajustados para a linguagem Fluent do ShadeFlow, evitando depender de uma fonte de ícones que pode faltar em outro computador. O símbolo de pasta do Organiza permanece como identidade do produto na barra superior; os cartões passam a usar pastas monocromáticas menores. Logos de serviços não precisam dominar a apresentação.

Não reduzir a janela do Organiza aos 1000 × 560 do ShadeFlow: a prévia contém mais colunas, caminhos e ações. Manter inicialmente os limites existentes e adaptar a distribuição do conteúdo. Em janelas menores, cartões e grupos de botões passam para uma coluna; tabelas podem ter rolagem horizontal localizada.

## Adaptação por tela

| Área | Proposta |
| --- | --- |
| Estrutura geral | Marca pequena na barra superior; lateral compacta com as cinco páginas atuais; conteúdo com título, frase curta e ações alinhadas. Substituir a marca grande que ocupa o topo da lateral. |
| Visão geral | Cartões de pastas menores e uniformes, com nome, caminho, disponibilidade e modo. Prévia em superfície neutra, com ferramentas agrupadas e ação principal clara. |
| Monitoramento | Mostrar o estado próximo das ações e manter os avisos visíveis. Distinguir visualmente pasta disponível e monitoramento ativo: disponibilidade não significa automação ligada. O mecanismo e os tempos de monitoramento continuam sendo os atuais. |
| Pastas | Mesmos cartões da visão geral, busca discreta, botão Adicionar pasta e menu contextual compacto. Nomes e caminhos longos não empurram ações para fora da janela. |
| Regras | Seletor de pasta em grupo neutro; cada categoria em cartão compacto com ícone, condições, destino, estado e ações. Categorias sugeridas seguem a aparência dos demais cartões. |
| Prévia | Cabeçalhos discretos, linhas legíveis, seleção visível e filtros com contagens. Caminhos completos acessíveis por tooltip ou detalhe. Botão de organizar se mantém associado à seleção e confirmação. |
| Arquivos sem regra | Cartões neutros por grupo, extensão em selo discreto, sugestão explicada e ações existentes. Evitar transformar todo o grupo em painel azul ou dar destaque excessivo à Lixeira. |
| Histórico | Lista de registros compacta, metadados secundários e origem/destino claramente separados. Desfazer e Abrir Lixeira continuam próximos ao registro correspondente. |
| Configurações | Grupos semelhantes aos de Preferências do ShadeFlow: título, descrição curta e switch. Manter as opções existentes e atualizar a descrição da aparência. |
| Diálogos | Superfície sólida, título e campos no padrão ShadeFlow; Cancelar e ação principal no rodapé. Formulários longos rolam dentro da área disponível. Incluir pasta, regra, exceções, monitoramento, revisão, movimentação, desfazer e Lixeira. |
| Estados vazios | Ícone monocromático, título curto, explicação e uma ação relevante. Evitar ilustrações grandes ocupando a área de trabalho. |
| Erros e progresso | Mensagem junto ao contexto afetado, contraste legível e indicador de progresso preservado. Ações indisponíveis continuam distinguíveis de ações ativas. |

## Interação e acessibilidade

- Hover leve, clique perceptível e estado desabilitado consistente, tomando os controles do ShadeFlow como referência.
- Foco de teclado com contorno azul e área de clique adequada; manter nomes acessíveis e a ordem de tabulação.
- Menu e diálogo devem preservar Escape, foco inicial e retorno ao controle de origem.
- Garantir contraste após a composição das transparências, inclusive texto secundário e mensagens de erro.
- Respeitar alto contraste/cores forçadas e preferência de movimento reduzido onde aplicável ao Electron.
- Texto ampliado e escala de 125%/150% não podem esconder confirmações nem ações de cancelamento.

## Execução prevista para a task 2

1. Criar uma base única de cores, fontes, tamanhos e espaçamentos em `styles.css`, removendo valores conflitantes dos componentes existentes.
2. Ajustar a estrutura de `index.html` e os componentes comuns de `app.js`: barra superior, marca, navegação, cabeçalhos, cartões e ícones.
3. Aplicar os padrões às regras/prévia, histórico/monitoramento e sugestões em seus arquivos de interface; uniformizar todos os diálogos.
4. Conferir telas com poucos e muitos itens, caminhos longos, estados vazios, erros, seleção, menus e navegação por teclado. Revisar também os textos de ajuda que hoje mencionam versões anteriores do fluxo de organização.
5. Executar as verificações existentes pertinentes aos fluxos afetados, produzir capturas comparáveis e gerar o novo pacote para Windows.

A atualização visual não requer mudanças em regras salvas, movimentação de arquivos, exclusões, histórico ou formato da configuração. Um Quick Panel semelhante ao do ShadeFlow, novos atalhos, bandeja e novos modos de automação seriam funcionalidades adicionais, não parte desta task.

## Critérios de conclusão da task 2

- As cinco páginas e todos os diálogos utilizam a mesma paleta e os mesmos controles.
- Marca, barra superior, lateral, tipografia e cartões permitem reconhecer a família visual ShadeFlow/Organiza.
- A aparência continua em tema escuro, com destaque azul suave e superfícies grafite.
- Todos os recursos atuais continuam acessíveis, inclusive revisão sem regra, confirmação manual, Lixeira e desfazer.
- Janela mínima suportada, janela ampliada e modo compacto não cortam ações essenciais.
- Evidência visual registrada e validações executadas descritas com seus limites; comportamento nativo no Windows só pode ser declarado validado quando efetivamente testado nele.

## Entrega desta task

Foi criado apenas este documento de análise e proposta. A interface e o pacote instalado permanecem na versão atual. A proposta recomendada é adotar o tema escuro do ShadeFlow, azul padrão fixo e controles compactos, preservando a organização das páginas do Organiza.
