# Base da interface — task 1

27/10/2026. Estrutura preparada para reconstruir as cinco telas aprovadas na task 2. Esta etapa organiza o cliente e os componentes comuns; a versão distribuída permanece 0.8.0.

## Responsabilidades

| Local | Responsabilidade |
| --- | --- |
| `desktop/MainWindow.xaml` e `.xaml.cs` | Janela, ciclo de vida, estado da sessão e coordenação da interface. |
| `desktop/MainWindow.Navigation.cs` | Liga os destinos de navegação aos controles da janela. |
| `desktop/Navigation/AppNavigation.cs` | Catálogo de páginas e contexto da pasta; independente de controles e do motor. |
| `desktop/Pages/` | Construção de cada tela, separada por responsabilidade. |
| `desktop/MainWindow.Preview.cs` | Área de arquivos, seleção e confirmação das operações. |
| `desktop/MainWindow.*Dialogs.cs` | Formulários e confirmações. |
| `desktop/MainWindow.RuleDialogs.cs`, `RuleConditionEditor.cs`, `PolicyDialogs.cs`, `ReviewDialogs.cs` | Construção dos formulários separada entre regras, condições, exceções e decisões sobre arquivos. |
| `desktop/MainWindow.FormValues.cs` | Conversão de valores numéricos dos formulários, com mensagens explícitas. |
| `desktop/Services/OrganizaClient.cs` | API do motor para a interface: comandos, argumentos, serialização dos cadastros/preferências e eventos. |
| `desktop/Services/IEngine.cs` | Contrato do transporte e encerramento; permite testar sem abrir processos. |
| `desktop/EngineBridge.cs` | Transporte JSON por pipes e ciclo de vida do processo. |
| `desktop/Services/Windows*Service.cs` | Explorador, seletor de pastas e registro de inicialização no Windows. |
| `desktop/Presentation/` | Componentes, ícones por significado, tipografia, modelo de linha e apresentação do progresso. |
| `desktop/Styles/Palette.xaml` | Cores-base; o serviço de tema mantém os nomes semânticos de brushes e a integração com o sistema. |
| `desktop/Styles/Tokens.xaml` | Fontes, dimensões e espaçamentos compartilhados. |
| `desktop/Styles/Controls.xaml`, `Native.xaml`, `Components.xaml` | Modelos, estados e estilos reutilizáveis. |

As páginas atuais ainda são partes da janela e compartilham seu estado de sessão. A separação não é apresentada como uma migração completa para MVVM: evita reescrever a aplicação inteira antes de implementar o desenho aprovado. Navegação, protocolo e serviços do Windows já têm limites próprios e podem ser reutilizados na reconstrução das telas.

## Componentes disponíveis

- `Ui.Text` recebe um `TextRole`, em vez de números espalhados para o tamanho de fonte.
- `Ui.Button`, `Ui.Icon`, `Ui.Switch` e `Ui.Choice` concentram padrões dos controles. Ícones usam `AppIcon`; códigos Unicode ficam no catálogo. Lixeira usa o estilo semântico de perigo.
- `Ui.Search` cria um `SearchField`: lupa, rótulo curto “Buscar”, nome acessível específico do contexto, largura compartilhada e superfície translúcida.
- `Ui.Card` e `Ui.Cards` concentram cartões e a distribuição responsiva de duas/uma coluna. `ResponsiveCardPanel` utiliza espaçamento, largura mínima e ponto de mudança vindos dos tokens.
- `Ui.Flyout` reutiliza superfície, teclado e tratamento de material para menus secundários.
- `Ui.Menus.cs` concentra menus e seletores translúcidos; `Ui.Layout.cs` fica com composição e alinhamento.
- `CompactTextInput`, `CompactSearchField` e `CompactChoice` compartilham `CompactControlHeight`; `MultilineTextInput` mantém o padrão para listas de exceções. Recursos `Menu*` são comuns às telas, sem nomes ligados à página que os criou.
- `OperationStatus` apresenta texto, ícone e progresso. `EngineProgress` interpreta dados do motor; `ProgressDisplay` cuida da mensagem/porcentagem. A descoberta e resultados parciais não inventam uma conclusão de 100%.
- `UiDialog` reutiliza corpo, confirmação, cancelamento e bloqueio durante o salvamento.

## Regras de manutenção

1. Uma nova página deve entrar no catálogo `AppPages`, com destino tipado, título e ícone. Não criar identificadores de rota em strings dentro de botões.
2. Cores e medidas reutilizadas entram na paleta/tokens. Estados de foco, hover, seleção e desabilitado ficam nos estilos, não em cópias por tela.
3. Valores locais que descrevem uma composição específica podem permanecer locais; não transformar cada número ou texto em uma configuração global. Extrair quando houver significado compartilhado.
4. A tela chama métodos de `OrganizaClient`, nunca nomes do protocolo como `trash:execute`. O cliente concentra ordem dos argumentos e detalhes de `params`, inclusive listas de arquivos/pastas.
5. Cadastro de pasta e alterações de preferências têm contratos de serialização explícitos. Os campos dinâmicos de regras e condições seguem o esquema já validado pelo motor, sem criar uma segunda implementação de suas regras de segurança em C#.
6. Operações de arquivo continuam no motor e no componente nativo. Alterar apresentação não deve remover confirmação, validação de identidade/metadados, diário ou proteção contra descarte permanente.
7. Navegar para regras preserva o contexto da pasta. Trocar a pasta ou remover seu cadastro limpa os retornos que deixaram de ser válidos.
8. Inscrições nos eventos do motor são removidas ao desconectar/fechar o cliente. O transporte expõe encerramento pelo contrato, sem a janela depender da implementação concreta.
9. O número da versão mostrado na interface vem do estado do motor. Caminhos de usuário vêm do cadastro ou das APIs do Windows; exemplos dos mockups não entram no aplicativo.
10. `desktop/.editorconfig` define o padrão de formatação. A ampliação dos componentes deve continuar pequena e orientada a usos reais, sem introduzir framework próprio ou dependências desnecessárias.
11. `Material` concentra valores nomeados da API DWM e o preparo do fundo nativo. Falhas opcionais deixam um fundo legível e emitem diagnóstico; erros reais de consulta à inicialização automática são propagados ao tratamento da interface.
12. A versão do empacotador é lida de `package.json`. Modificar esse script não gera um pacote nem atualiza a instalação.

## Validação

`desktop/Checks/FoundationChecks.cs` cobre navegação, contexto removido, serialização, lista de pastas, cancelamento, desligamento de eventos, busca acessível, tokens em controles existentes e progresso. A suíte nativa também continua exercitando as telas reais, modais, organização, desfazer e Lixeira com dados temporários.

No Windows:

```powershell
dotnet build desktop/Organiza.Wpf.csproj -c Release
dotnet build desktop/Checks/Organiza.Checks.csproj -c Release
dotnet desktop/Checks/bin/Release/net8.0-windows/Organiza.Checks.dll <pasta-do-motor-publicado> <pasta-de-evidencias>
```

A pasta do motor publicado precisa conter `runtime/node.exe` e `engine`. Nesta task, os testes usam o motor 0.8.0 já publicado, cujos fontes foram comparados por SHA-256 para confirmar que não mudaram. O cliente e os controles são compilados dos fontes atuais dentro da suíte nativa.

O redesenho integral das páginas fica na task 2. A geração e validação do novo pacote de entrega ficam na task 3. A aparência real do Windhawk exige inspeção física; as capturas da suíte são renderizações com fundo composto.

## Identidade dos estados

As regras de cor, ícone e texto são compartilhadas por `StatusPresentation` e
`FilePresentation`. O cartão separa modo, pendências e metadados; o modo não é
substituído por um aviso de revisão. Convenções e pontos de manutenção estão
em [Identidade dos estados](identidade-de-estados.md).
