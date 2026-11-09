# Publicação inicial — 8 de novembro de 2026

A preparação preservou a licença proprietária e a autoria de George GS Matos.
O repositório registra o estado atual dos fontes, sem reconstruir commits anteriores.

## Validação local

- Motor Node Linux: 87 testes aprovados, incluindo links simbólicos.
- Motor Node Windows: 86 aprovados e um dispensado por falta de privilégio de symlink de arquivo; a regressão foi aprovada no Linux.
- Transferências nativas Windows: três aprovadas; teste entre volumes dispensado por ausência de um segundo volume de teste.
- WPF/integração Windows: 129 verificações aprovadas, incluindo inicialização, identidade de estados, modos por pasta e bandeja.
- Supervisor WSL: seis testes aprovados.
- Builds de produção Windows x64 gerados com SDK .NET 8 no WSL.
- Sintaxe dos scripts PowerShell conferida pelo parser do Windows.
- Workflows conferidos com actionlint 1.7.12, fixação de Actions por SHA e permissões mínimas.
- ZIP autocontido conferido quanto a integridade, licença e ausência de perfis, logs e credenciais.
- Hash SHA-256 gerado para o pacote binário.
- Runtime Node oficial preparado por download verificado e extração apenas do executável e licença.
- Capturas renderizadas dos controles reais usam dados de teste e caminhos pessoais omitidos.

## Limites

Esta rodada não comprova o efeito físico do DWM/Windhawk, superfícies protegidas,
modo exclusivo em jogos, múltiplos monitores físicos ou o próximo login do Windows.
Os executáveis não têm assinatura digital de editor. Os testes não foram executados
sobre documentos ou perfis de produção.

## Automação

CI usa Windows para os componentes nativos e Linux para o supervisor WSL.
Releases futuras podem ser preparadas pelo workflow manual, que exige tag e versão
consistentes, repete as verificações e cria um rascunho para revisão.

## Compatibilidade do runner Windows

A primeira execução no GitHub expôs fixtures que comparavam caminhos temporários curtos 8.3 com os caminhos canônicos retornados pelo cadastro de pastas. As mesmas duas falhas foram reproduzidas localmente usando um alias 8.3. As fixtures passaram a normalizar o diretório temporário antes de montar os cenários, preservando todas as asserções. A distribuição pública usa a versão 0.8.1; a tag 0.8.0 permanece no histórico inicial, sem reescrita.

Após a correção, os 20 testes de organização passaram também com TEMP/TMP apontando para um alias curto 8.3, na mesma reprodução que antes falhava. A rodada Windows completa permaneceu aprovada.

## Dependências de desenvolvimento

O alerta de minimatch foi rastreado ao empacotamento Electron legado. Electron, electron-builder e Playwright não participam do cliente WPF nem dos testes atuais; suas dependências e comandos foram removidos do manifesto ativo, preservando o código histórico para consulta. O motor atual usa módulos nativos do Node, sem dependências npm. A auditoria npm do manifesto final retornou zero vulnerabilidades.

Os casos responsivos verificam uma e duas colunas em larguras lógicas controladas, sem depender da resolução do desktop do runner. A integração da tela verifica o número de colunas para a largura efetivamente disponível.

O controlador de diálogos aguarda a janela visível após o planejamento assíncrono, com uma regressão que força esse intervalo. A fase que chama o motor diretamente permanece fora da página de Pastas para não competir com a análise automática da própria interface.
