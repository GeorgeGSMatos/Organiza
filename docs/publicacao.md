# Publicação inicial — 8 de novembro de 2026

A preparação preservou a licença proprietária e a autoria de George GS Matos.
O repositório registra o estado atual dos fontes, sem reconstruir commits anteriores.

## Validação local

- Motor Node Linux: 87 testes aprovados, incluindo links simbólicos.
- Motor Node Windows: 86 aprovados e um dispensado por falta de privilégio de symlink de arquivo; a regressão foi aprovada no Linux.
- Transferências nativas Windows: três aprovadas; teste entre volumes dispensado por ausência de um segundo volume de teste.
- WPF/integração Windows: 126 verificações aprovadas, incluindo inicialização, identidade de estados, modos por pasta e bandeja.
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
