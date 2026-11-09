param(
    [string]$PublishDirectory,
    [string]$TargetDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\Organiza'),
    [switch]$Reopen
)
$ErrorActionPreference = 'Stop'
if (-not $PublishDirectory) {
    if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'Organiza.exe')) {
        $PublishDirectory = $PSScriptRoot
    } else {
        $root = Split-Path $PSScriptRoot -Parent
        $metadata = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
        $PublishDirectory = Join-Path $root ('release\wpf-' + $metadata.version)
    }
}
$parent = Split-Path $TargetDirectory -Parent
$name = Split-Path $TargetDirectory -Leaf
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$stage = Join-Path $parent ($name + '-update-' + $stamp)
$backup = Join-Path $parent ($name + '-backup-' + $stamp)
$required = @('Organiza.exe','Organiza.dll','runtime\node.exe','engine\engine\server.cjs','engine\engine\monitoring-session.cjs','engine\main\store.cjs','engine\main\preview.cjs')
function Assert-ApplicationClosed {
    $running = @(Get-CimInstance Win32_Process -Filter "Name='Organiza.exe'" | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($TargetDirectory + '\', [StringComparison]::OrdinalIgnoreCase)
    })
    if ($running.Count) { throw 'Encerre o Organiza pelo menu da bandeja > Sair antes de atualizar.' }
}
foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $PublishDirectory $file) -PathType Leaf)) { throw "Arquivo ausente na publicacao: $file" }
}
Assert-ApplicationClosed
New-Item -ItemType Directory -Path $parent -Force | Out-Null
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    Get-ChildItem -LiteralPath $PublishDirectory -Force | Copy-Item -Destination $stage -Recurse -Force
    foreach ($file in $required) {
        $expected = (Get-FileHash -LiteralPath (Join-Path $PublishDirectory $file) -Algorithm SHA256).Hash
        $actual = (Get-FileHash -LiteralPath (Join-Path $stage $file) -Algorithm SHA256).Hash
        if ($expected -ne $actual) { throw "Copia divergente: $file" }
    }
    Assert-ApplicationClosed
    $previous = Test-Path -LiteralPath $TargetDirectory
    if ($previous) { Move-Item -LiteralPath $TargetDirectory -Destination $backup }
    try { Move-Item -LiteralPath $stage -Destination $TargetDirectory }
    catch {
        if ($previous) { Move-Item -LiteralPath $backup -Destination $TargetDirectory }
        throw
    }
} finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
$executable = Join-Path $TargetDirectory 'Organiza.exe'
if ($Reopen) { Start-Process -FilePath $executable -ArgumentList '--background' }
[PSCustomObject]@{Executable=$executable;Backup=if($previous){$backup}else{$null};Reopened=[bool]$Reopen} | ConvertTo-Json -Compress
