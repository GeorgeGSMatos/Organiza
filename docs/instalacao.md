# Instalação e atualização

## Requisitos

Windows 10/11 x64. O ZIP oficial é autocontido e inclui .NET e Node.js; não é necessário instalar ferramentas de desenvolvimento.

## Primeira execução

1. Baixe a Release estável do repositório oficial e o arquivo SHA256SUMS correspondente.
2. Confira o pacote com `Get-FileHash .\nome-do-pacote.zip -Algorithm SHA256` e compare o resultado com o arquivo publicado.
3. Extraia o ZIP inteiro para uma pasta **local**, fora do compartilhamento WSL.
4. Abra `Organiza.exe`. Não separe o executável dos demais arquivos.

Os executáveis ainda não são assinados digitalmente. Leia qualquer aviso do Windows e confirme a origem do download; não desative mecanismos de segurança do sistema.

## Atualizar

Encerre pelo ícone da bandeja → **Sair**. O X apenas recolhe a janela. Preserve uma cópia da versão anterior até confirmar a nova.

O pacote inclui `Atualizar-Organiza.ps1`. Execute-o no PowerShell, a partir da pasta extraída: `& .\Atualizar-Organiza.ps1 -Reopen`. Ele copia o aplicativo para `%LOCALAPPDATA%\Programs\Organiza` e preserva o perfil. Se preferir uma instalação portátil, substitua a pasta inteira com o aplicativo encerrado.

## Dados e inicialização

As configurações ficam em `%APPDATA%\Organiza`, fora da pasta do executável. Regras e histórico ficam nesse perfil; uma atualização não deve substituí-los.

Ative **Iniciar com o Windows** na instalação local. O aplicativo inicia na bandeja, na sua conta de usuário, sem exigir administrador. O modo Manual/Automática é salvo por pasta.

Para desinstalar uma cópia portátil, encerre e desative o início com Windows antes de remover a pasta. O perfil pode ser mantido para reinstalação. A limpeza desse perfil é uma decisão separada e remove suas configurações.
