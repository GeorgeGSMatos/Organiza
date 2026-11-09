param([switch]$SkipPackage)
$ErrorActionPreference = 'Stop'
$env:PATHEXT = '.COM;.EXE;.BAT;.CMD;' + $env:PATHEXT
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    if (!(Test-Path 'desktop\runtime\node.exe')) { & "$PSScriptRoot\Prepare-Runtime.ps1" }
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    $projectVersion = ([xml](Get-Content desktop\Organiza.Wpf.csproj -Raw)).Project.PropertyGroup.Version | Where-Object { $_ }
    if ($version -ne $projectVersion) { throw 'Versoes do package.json e projeto WPF divergentes.' }
    & dotnet publish desktop/Organiza.Wpf.csproj -c Release -r win-x64 --self-contained true -o "release/wpf-$version" --nologo
    if ($LASTEXITCODE -ne 0) { throw 'Falha no publish do Organiza.' }
    if (!$SkipPackage) {
        & python scripts/package-wpf.py
        if ($LASTEXITCODE -ne 0) { throw 'Falha no empacotamento.' }
    }
} finally { Pop-Location }
