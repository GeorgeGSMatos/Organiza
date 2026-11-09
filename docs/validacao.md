# Validação do Organiza

## Rodada Windows

Requisitos: PowerShell 5.1+, SDK .NET 8, Python 3.12 e Node.js 22.

Na raiz do checkout, execute `powershell -NoProfile -File scripts/Validate.ps1`.
O script encerra com erro quando uma verificação obrigatória falha. O GitHub
Actions executa a mesma entrada em Windows, sem usar o perfil instalado.

A rodada inclui testes do motor Node, transferências nativas e verificações WPF sobre pastas temporárias. O teste entre dois volumes NTFS é opcional e exige ORGANIZA_TEST_OTHER_DRIVE apontando para um segundo volume de teste.

Capturas renderizadas da interface usam dados de teste. Não comprovam o efeito
DWM, Windhawk, composição do desktop, monitores físicos ou o comportamento de um
login real do Windows. Esses pontos exigem conferência manual no equipamento.

## Política de execução

No trabalho assistido por agente, executar testes, lint e build exige `/test`
ou solicitação explícita. A preparação inicial deste repositório foi autorizada
com as três tasks de preparação, validação e publicação. Não publicar resultados
antigos como se tivessem sido obtidos sobre o código atual.

## Supervisor WSL

O supervisor depende de `fcntl` e é validado no Linux/WSL, em job próprio do CI:

```bash
python3 -m unittest discover -s test -p dev_runner_test.py -v
```

Os testes portáveis do motor também executam no job Linux, incluindo links simbólicos de arquivos. No Windows, esse caso pode ser dispensado explicitamente se a conta não tiver o privilégio necessário; a proteção contra junctions é verificada separadamente e permanece obrigatória. A cópia entre dois volumes requer um segundo volume de teste e não é simulada por uma cópia no mesmo volume.
