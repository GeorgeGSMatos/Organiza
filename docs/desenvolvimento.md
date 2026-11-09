# Desenvolvimento com atualização automática

No Explorer, abra a pasta do projeto no WSL e dê dois cliques em
`Iniciar-Organiza-Dev.cmd`. Mantenha o terminal aberto enquanto faz alterações.
Use o arquivo original dentro do projeto; baixar ou copiar somente o CMD pelo
chat não inclui os scripts necessários. O iniciador mostra a pasta utilizada e
mantém as mensagens visíveis ao terminar, inclusive quando a abertura falha.
Também é possível iniciar pelo terminal WSL, na raiz do projeto:

```bash
bash scripts/dev.sh
```

O iniciador compila uma versão Debug e abre a janela no Windows, identificada
como **Organiza · Desenvolvimento**. Depois, acompanha os arquivos salvos:

| Alteração | Comportamento |
| --- | --- |
| Paleta, tamanhos, fontes e estilos em `desktop/Styles` | Recarrega os cinco dicionários de recursos na janela aberta. |
| Páginas, controles, estrutura XAML e código C# | Compila incrementalmente e reinicia a janela automaticamente. |
| Motor Node e integração nativa | Atualiza os arquivos e reinicia o aplicativo. |
| Código inválido | Mostra o erro no terminal e mantém a última janela funcional. Corrija e salve novamente. |

Há uma compilação inicial e novas compilações para mudanças de código. O fluxo
não gera pacotes ZIP, não publica versões e não executa a suíte de testes a cada
edição. Os testes continuam necessários para validar mudanças de comportamento
e antes da entrega de uma versão.

Atualizações aguardam o fim da operação atual e o fechamento de editores ou menus.
No reinício, o aplicativo restaura a página, a pasta, os filtros e a posição da
janela. Se havia uma prévia, ela é analisada novamente; planos antigos de movimentação
não são reaproveitados. Feche a janela ou use Ctrl+C no terminal para encerrar.

## Perfil de desenvolvimento

As configurações ficam em `.dev/profile`, separadas do perfil instalado do Windows.
Na primeira abertura, são criadas três pastas de exemplo em `.dev/examples`. Os
arquivos de exemplo são pequenos textos com extensões variadas, destinados a testar
a classificação, e não documentos ou imagens reais. Esse perfil persiste entre
execuções. Você também pode cadastrar pastas nele; as operações nessas pastas são reais.

Para iniciar um perfil vazio, antes de sua primeira abertura use:

```bash
bash scripts/dev.sh --no-demo
```

O modo de desenvolvimento desabilita a opção de iniciar com o Windows. A instalação
normal continua usando seu perfil habitual. O controle de atualização só existe na
compilação Debug e usa arquivos locais, sem abrir uma porta de rede.

## Requisitos e diagnóstico

Requer WSL com Python 3.12 ou superior, runtime .NET Desktop 8 x64 no Windows e
`desktop/runtime/node.exe`. O SDK .NET 8 do WSL é localizado automaticamente ou
preparado em `.dev/sdk`, com verificação SHA-512 do pacote oficial. A primeira
preparação/restauração pode precisar de internet. O SDK é preparado localmente quando necessário.

Para escolher outro SDK ou cache NuGet:

```bash
bash scripts/dev.sh --dotnet /caminho/para/dotnet --nuget-cache /caminho/para/cache
```

Os erros de compilação aparecem no terminal. Os logs da janela ficam em
`.dev/application.log`; falhas na inicialização também ficam em
`.dev/control/<sessão>/startup-error.txt`. A pasta `.dev` contém ferramentas,
configurações e cópias de execução locais e está ignorada pelo versionamento.
As cópias evitam substituir arquivos que o Windows está usando. Elas se acumulam
durante o desenvolvimento; podem ser removidas de `.dev/runs` com o iniciador e
o aplicativo fechados. Preserve `.dev/profile` para manter suas configurações.

Para verificar especificamente esse fluxo:

```bash
python3 -m unittest discover -s test -p 'dev_runner_test.py' -v
python3 test/dev_integration.py --dotnet "$PWD/.dev/sdk/dotnet" --nuget-cache "$PWD/.dev/nuget"
```

O teste de integração usa uma cópia descartável do projeto, abre uma janela oculta
no Windows e verifica atualização ao vivo, recuperação de erros e reinício.
