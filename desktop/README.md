# Organiza WPF 0.8.0

A base da interface foi reorganizada para a reconstrução aprovada das cinco telas. O mapa de responsabilidades, os componentes e as regras de manutenção estão em [Arquitetura da interface](../docs/arquitetura-interface-organiza.md). Os estilos compartilhados ficam em `Styles/Palette.xaml`, `Tokens.xaml` e `Components.xaml`; navegação em `Navigation/`; acesso ao motor e ao Windows em `Services/`; páginas em `Pages/`; componentes e modelos visuais em `Presentation/`.

A interface publicada agora é WPF/.NET 8, sem Electron e sem WebView. As cinco páginas e os diálogos são controles nativos. `Material.cs` solicita o mesmo tipo de material DWM da janela principal do ShadeFlow e libera o fundo WPF quando a composição está disponível. O resultado exato com o Translucent Windows precisa ser conferido na tela com a configuração do mod usada pelo usuário.

O motor de organização existente foi integrado, não reescrito. `EngineBridge.cs` conversa por JSON em pipes privados com `src/engine/worker.cjs`, executado pelo Node oficial incluído no pacote. O motor reutiliza os módulos de regras, prévia, revisão, movimentação, monitoramento e histórico. Não há servidor HTTP nem porta de rede. O usuário não precisa instalar Node ou .NET.

## Dados e encerramento

O perfil permanece em `%APPDATA%\Organiza`, com `config.json` v3 e `history.jsonl`. O cliente nativo impede outra sessão WPF com o mesmo perfil e recusa iniciar ao detectar outro processo Organiza. Feche a versão Electron antes de abrir esta versão.

No encerramento normal, o motor pausa o monitoramento, cancela a análise e termina o arquivo atual antes de fechar o componente nativo. Um Job Object associa os processos filhos à janela para evitar monitoramento sem interface após um encerramento abrupto. A recuperação e o diário continuam tratando operações interrompidas.

A Lixeira usa IFileOperation em STA, com veto a operações sem `TSF_DELETE_RECYCLE_IF_POSSIBLE`. Não há fallback de exclusão permanente. O fluxo continua validando metadados e registrando a intenção antes de solicitar reciclagem.

O worker PowerShell é iniciado com diretório de trabalho em `engine/native`, separado das DLLs .NET 8 da raiz publicada. Isso evita que `Add-Type` resolva referências do .NET Framework para bibliotecas incompatíveis do pacote independente.

## Compilar

No Windows, com SDK .NET 8 e o Node 22.23.4 oficial x64 em `desktop/runtime/node.exe`:

```powershell
dotnet publish desktop/Organiza.Wpf.csproj -c Release -r win-x64 --self-contained true -o release/wpf-0.8.0
python scripts/package-wpf.py
```

O ZIP oficial do Node foi conferido com SHA-256 `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20`. Inclua a licença oficial como `desktop/runtime/LICENSE-Node.txt` antes de publicar. O snapshot de código exclui os binários do runtime; eles são necessários para publicar, mas já vêm na versão pronta.

Os testes `desktop/Checks` compilam as telas reais na mesma unidade WPF e usam um perfil temporário no Windows. Suprimem o startup de produção e não abrem as pastas reais do usuário. As operações nativas de teste usam somente arquivos criados no diretório temporário próprio.

O código Electron anterior permanece em `src/renderer` e em seus pontos de entrada para referência e regressões históricas. Ele não é incluído no pacote WPF. `npm test` continua verificando o motor; Playwright é apenas a suíte da interface anterior, não a validação da nova interface.

## Experiência 0.8.0

Visão geral não hospeda a análise. O cartão abre uma área por pasta em Pastas; a seleção permanece nessa área após mover/reciclar. O cliente busca uma nova prévia válida após operações e preserva a seleção restante, filtros e ordenação. Falhas permanecem identificadas; nunca reutiliza tokens da prévia invalidada.

A Lixeira aceita arquivos elegíveis com ou sem regra, de formatos diferentes, na mesma pasta. Revisão/categoria continua restrita a itens sem regra. A atribuição de categoria em formatos mistos é apenas para a seleção; criar regra futura exige um formato.

A análise primeiro descobre os itens dentro dos limites e depois os classifica. Eventos distinguem `discovering` de `analyzing`, com total/completed apenas quando há denominador. Operações em lote informam itens processados e resultados individuais.

`Ui.Flyout` e o Popup dos seletores usam janelas sem camada de transparência WPF; `Material.Floating` prepara a composição DWM e aplica uma tonalidade translúcida somente após as chamadas nativas. Falhas, alto contraste e transparência desativada mantêm fundo sólido legível. A integração visual com o Windhawk precisa de inspeção física.

## Reconstrução das telas — task 2

As cinco telas dos mockups aprovados foram aplicadas aos componentes da task 1. A composição e os fluxos estão descritos em [Task 2](../docs/task-2-interface.md), com capturas reais e evidências em `outputs/task-2-interface/README.md`. Esta alteração está nos fontes; o pacote anterior 0.8.0 permanece como distribuição anterior até a task 3.
