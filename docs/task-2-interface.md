# Task 2 — reconstrução das cinco telas

27/10/2026. Implementação baseada nas cinco imagens aprovadas em `outputs/proposta-interface-2026-10-27`. O aplicativo usa dados reais do cadastro, da análise e do diário; os exemplos dos mockups não foram incorporados ao produto.

## Telas

- **Visão geral:** resumo de pastas/monitoramento/revisão, cartões clicáveis em duas colunas, data da última análise e última atividade do histórico. Análises não realizadas aparecem como pendentes; contagens parciais são identificadas. A tela não inicia varreduras para preencher números.
- **Pastas:** a navegação abre a área da pasta selecionada. O seletor permite trocar de pasta sem voltar à Visão geral. Cabeçalho, controle de automação, filtros em abas, busca contextual, tabela com seleção em lote e painel de detalhes/sugestões seguem a composição aprovada. Em janela menor o painel fica abaixo da tabela.
- **Regras:** seletor da pasta e exceções, busca contextual, nova regra, cartões com condições resumidas/destino, ativação e ícones de edição/remoção. Os detalhes completos permanecem no editor; o resumo usa as extensões fornecidas pelo motor. Duas colunas quando há espaço, uma na janela menor.
- **Histórico:** linhas agrupadas por data, busca curta com lupa, filtros de pasta/período/situação e paginação preservada. Falhas mostram o motivo e oferecem detalhes. A Lixeira e o Explorador usam ícones; desfazer aparece somente quando a operação permite. Solicitações de reciclagem que falharam não são apresentadas como arquivos efetivamente na Lixeira.
- **Configurações:** preferências gerais, dados locais e Sobre. A visualização compacta foi retirada da interface e deixou de modificar os cartões. O campo legado pode permanecer no arquivo de configuração para compatibilidade. Preferências são salvas automaticamente; a ação de abrir os dados usa o perfil ativo do transporte, inclusive nos testes isolados.

## Componentes e estado

Paleta, tipografia, espaçamentos e dimensões continuam centralizados em `Styles`. Abas, linhas, barras de ações e grupos de ícone/texto reutilizam `Presentation/Ui.Layout.cs`; a tabela de arquivos usa templates compartilhados. A seleção inclui destaque azul e checkbox; as ações de Lixeira usam a cor semântica vermelha. Cores de sucesso/revisão acompanham ícones e palavras.

`HistoryRecord` e `HistoryFilters` separam dados e filtros da montagem visual. A lista de arquivos ficou em `Pages/MainWindow.Files.cs`, enquanto confirmação/execução continuam em `MainWindow.Preview.cs`. O motor continua validando destinos, arquivos e planos; a interface preserva as confirmações e a permanência na pasta depois de cada operação.

O cliente bloqueia os controles de ação quando há uma operação em curso, preserva o contexto de busca/filtros e mantém falhas selecionadas. O rodapé informa o estado da tela ou o resultado da operação. Ajuda contextual está disponível pela lateral e pelas telas relevantes.

## Escopo da entrega

As cinco telas foram reconstruídas e integradas ao motor existente. A task 3 continua responsável pelo novo pacote de distribuição, pela conferência final do executável e pela inspeção física do material/transparência com a configuração do Windows/Windhawk.

Os testes desta etapa compilam a interface atual e usam o motor publicado 0.8.0, que permaneceu idêntico aos fontes por SHA-256. Não houve substituição automática da instalação do usuário ou do ZIP anterior.

Capturas e resultados: `outputs/task-2-interface/README.md`.
