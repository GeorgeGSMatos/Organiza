# Revisão e organização do código — 02/11/2026

## Escopo

Revisão estrutural conforme `instruções globais do agente`: arquitetura,
duplicação, responsabilidades, recursos de interface, scripts e caminhos de erro.
O levantamento abrangeu WPF, cliente/transporte do motor, módulos Node, integração
nativa, ferramentas de desenvolvimento e entradas legadas do Electron. A leitura
dos fluxos críticos foi complementada por busca de padrões e análise de sintaxe.
Isso não constitui uma auditoria funcional ou de segurança completa.

A pasta de trabalho não contém repositório Git. A comparação foi feita com uma
cópia anterior dos fontes em
`/tmp/organiza-before-code-organization-20261102-004756.tar.gz`.

## Organização aplicada

| Área | Resultado |
| --- | --- |
| Formulários | `MainWindow.RuleDialogs.cs`, `RuleConditionEditor.cs`, `PolicyDialogs.cs` e `ReviewDialogs.cs` separam construção de regra, edição de condição, exceções e decisões sobre arquivos. |
| Conversão de campos | `MainWindow.FormValues.cs` concentra a conversão numérica com nome explícito e mensagens de erro. O conteúdo de `MainWindow.Dialogs.cs` foi redistribuído entre esses arquivos. |
| Componentes comuns | `Presentation/Ui.cs` mantém fábricas básicas, `Ui.Layout.cs` composição e `Ui.Menus.cs` menus, teclado, material e listas suspensas. |
| Campos compactos | `CompactControlHeight` substitui três definições iguais de 32 px. `CompactInputPadding` elimina o espaçamento duplicado. Os estilos `CompactTextInput`, `CompactSearchField`, `CompactChoice` e `MultilineTextInput` têm nomes reutilizáveis entre páginas. |
| Busca | A fábrica `Ui.Search(..., compact: true)` concentra a configuração antes repetida em Pastas, Regras e Histórico. |
| Menus | Recursos `Menu*`, `MenuActionButton`, `DangerMenuActionButton` e `LeadingIconMargin` deixam de depender do nome Visão geral quando são comuns a outras telas. |
| Material | Chamadas nativas repetidas foram reunidas em `TryApplyBackdrop`, com tipos de material e atributos DWM nomeados. Os fundos sólidos continuam sendo definidos antes da tentativa de composição. |
| Diagnóstico | Indisponibilidade opcional de material/tema e fechamento do canal de diagnóstico do motor emitem mensagens Trace. Erros reais de leitura do registro de inicialização automática são propagados à interface, em vez de aparecerem como preferência desativada. |
| Empacotamento | `package-wpf.py` lê a versão de `package.json`. Nenhum pacote foi gerado. |

As mudanças preservam a composição visual aprovada e o protocolo de organização
dos arquivos. A diferença intencional de tratamento de erro é a mensagem explícita
quando não é possível consultar a configuração de inicialização do Windows.

## Verificações realizadas

- Formatação de espaços dos arquivos C# reorganizados com `dotnet format whitespace`,
  seguindo `desktop/.editorconfig`.
- Compilação Debug final do WPF em `.dev/code-organization-build`: **zero avisos e zero erros**.
- Checagem de sintaxe dos **20 arquivos JavaScript** de `src` com `node --check`.
  A primeira tentativa de acesso ao Node Windows não executou por expiração da
  análise automática de permissão; a conferência foi concluída pelo PowerShell.
- Análise de sintaxe dos **dois scripts Python**, sem executar o empacotador.
- Leitura dos **dez arquivos XML/XAML/projetos**, incluindo conferência de chaves
  explícitas duplicadas nos dicionários de estilos: nenhuma duplicação encontrada.
- Comparação dos conteúdos de `src`, `test` e `desktop/Checks` com a cópia inicial:
  **preservados**. O motor e o componente nativo não foram refatorados nesta etapa.

## Limites e manutenção

A suíte funcional não foi executada e não houve inspeção visual de cada estado
das janelas após a reorganização. A compatibilidade visual do Windhawk continua
dependendo de observação no Windows do usuário.

Atualização posterior: o comando `/test` foi executado em 02/11/2026. Os resultados,
as regressões acrescentadas, as capturas inspecionadas e as limitações estão no
[relatório de testes](../outputs/test-2026-11-02/README.md). A observação acima
descreve o encerramento da revisão estrutural, antes desse comando.

O motor mantém as decisões existentes de segurança e recuperação. Alguns catches
em filas, cancelamento, limpeza e recuperação são deliberados: não devem ser
substituídos em massa, pois preservam a exceção original, permitem a continuação
da fila ou classificam uma operação como não confirmada. Mudanças nesses fluxos
precisam de reprodução e testes específicos de movimentação e recuperação.

O código Electron permanece como implementação legada identificada no projeto;
esta revisão não autoriza seu descarte. O projeto também continua usando arquivos
parciais da janela principal, conforme sua arquitetura atual, sem migração para
outro framework de apresentação.
