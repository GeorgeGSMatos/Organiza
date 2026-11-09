# Arquitetura do Organiza

Aplicativo Windows x64 com interface WPF e .NET 8. Não há backend remoto obrigatório.

| Área | Responsabilidade |
| --- | --- |
| `desktop/Pages` | Telas e composição de navegação |
| `desktop/Presentation` | Componentes, modelos e identidade de estados |
| `desktop/Styles` | Paleta, medidas e estilos compartilhados |
| `desktop/Services` | Cliente do motor, bandeja, shell e inicialização |
| `src/engine` | Protocolo JSON por pipes e execução do motor |
| `src/main` | Regras, prévia, monitoramento, operações e histórico |
| `src/native` | Operações nativas de arquivos no Windows |
| `test` e `desktop/Checks` | Testes com perfis e arquivos temporários |

A interface WPF se comunica com o motor Node.js por pipes privados; não há servidor HTTP. O pacote inclui o runtime Node oficial. `src/renderer` e os pontos de entrada Electron são legado preservado para consulta e testes históricos; não compõem a distribuição WPF.

## Perfis e ciclo de vida

O perfil normal fica em `%APPDATA%\Organiza`. Desenvolvimento usa `.dev/profile`, com serviços restritos para evitar interferência no uso normal. Fechar a janela principal recolhe a versão normal à bandeja; **Sair** conclui o encerramento.

Os estilos usam recursos compartilhados para cores, medidas e estados. Ajuda contextual fica na navegação; informações do produto e diagnóstico ficam no cartão Sobre de Configurações. Recursos de composição respeitam as preferências e capacidades do Windows.
