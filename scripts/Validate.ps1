param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$env:PATHEXT = '.COM;.EXE;.BAT;.CMD;' + $env:PATHEXT
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    if (!$SkipBuild) {
        & "$PSScriptRoot\Build-Release.ps1" -SkipPackage
        & dotnet build desktop/Checks/Organiza.Checks.csproj -c Release -o artifacts/checks --nologo
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar checks WPF.' }
    }

    $node = Join-Path $root 'desktop\runtime\node.exe'
    foreach ($test in Get-ChildItem test -Filter '*.test.cjs') {
        & $node --test $test.FullName
        if ($LASTEXITCODE -ne 0) { throw ('Falha no teste do motor: ' + $test.Name) }
    }
    & $node --test test/native.windows.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes nativos Windows.' }
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    $application = Join-Path $root "release\wpf-$version"
    & dotnet artifacts/checks/Organiza.Checks.dll $application artifacts/validation/ui
    if ($LASTEXITCODE -ne 0) { throw 'Falha nos checks completos WPF.' }
    foreach ($mode in @('--startup','--status-identity')) {
        & dotnet artifacts/checks/Organiza.Checks.dll $mode
        if ($LASTEXITCODE -ne 0) { throw "Falha em $mode." }
    }
    foreach ($mode in @('--folder-workflow','--tray')) {
        & dotnet artifacts/checks/Organiza.Checks.dll $mode $application
        if ($LASTEXITCODE -ne 0) { throw "Falha em $mode." }
    }

    Write-Host 'Validacao obrigatoria concluida. Integracoes fisicas dependem de conferencia manual.'
} finally { Pop-Location }
