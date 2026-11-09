# Identidade visual dos estados

## Convenção

| Tom | Significado | Exemplos |
| --- | --- | --- |
| Azul | Automação e ação principal | Modo Automática, regra ativa, operação em andamento |
| Lilás | Organização manual | Modo Manual, sem associação com erro ou indisponibilidade |
| Amarelo | Atenção | Revisão, conflito, indisponibilidade, execução aguardando |
| Verde | Operação concluída | Organizado, restauração/desfazer concluído |
| Vermelho | Exclusão ou falha | Lixeira, remoção, transferência não concluída |
| Cinza | Informação neutra | Metadados, horário, ignorado, regra pausada |
| Texto normal | Pronto para uma ação | Arquivo pronto, ainda não organizado |

Cor complementa ícone e texto; não é a única forma de distinguir os estados.
No alto contraste, os recursos utilizam as cores do sistema.

## Cartões de pasta

1. Nome, caminho e menu formam o cabeçalho.
2. Uma linha mostra ícone/modo e interruptor agrupados à esquerda, sem o rótulo redundante Organização.
3. Pendências e impedimentos aparecem em linhas independentes, quando existem.
4. Divisor e rodapé separam o horário da última análise dos controles.

O modo permanece visível quando existem arquivos para revisar. A alavanca sem
rótulo visual preserva o nome acessível e a explicação de disponibilidade; o
estado Manual tem identificação lilás, mas a trilha desligada fica neutra.
O contorno branco de hover e o fundo existente são preservados.

## Implementação

- `Presentation/StatusPresentation.cs`: tons e representação dos modos.
- `Presentation/FilePresentation.cs`: classificação única dos estados de arquivos.
- `Presentation/Ui.Layout.cs`: representação compartilhada de ícone e texto.
- `Styles/Palette.xaml` e `ThemeService.cs`: cores por tema e alto contraste.
- `Styles/Tokens.xaml`: espaçamentos próprios dos cartões.
- `PreviewItem.Tone` e `FileStatusCell`: tabela seguindo a classificação compartilhada.
- `OperationStatus`: tom explícito para andamento, atenção, falha e resultado.

Para adicionar um estado, defina seu significado antes de escolher uma cor.
Evite cores literais em páginas e classificações paralelas de arquivo.

## Situação da validação

Foram preparados testes em `Checks/StatusIdentityChecks.cs`, acessíveis pela
opção `--status-identity` do executável de verificações. Esses testes não foram
executados, nem foram realizados lint ou análise de tipos.

Após solicitação explícita para manter o executável instalado atualizado,
a publicação Release Windows foi compilada com sucesso e a instalação local
foi atualizada pelo script `Update-Organiza.ps1`, preservando a versão anterior
e reabrindo o aplicativo na bandeja. A aparência renderizada ainda não foi
conferida nesta rodada.

## Alinhamento do modo de organização

Na Visão geral e em Pastas, ícone, Manual/Automática e alavanca formam um grupo
compacto à esquerda, sem o rótulo Organização. Pastas inclui a ajuda após a
alavanca. O mesmo componente atende às duas telas, sem colunas ou espaços
reservados para o rótulo removido.
