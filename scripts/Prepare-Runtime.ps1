param([string]$Version = '22.23.4')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Versao Node invalida.' }
$root = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $root 'desktop\runtime'
$cache = Join-Path $root '.dev\downloads'
New-Item -ItemType Directory -Path $cache -Force | Out-Null
$archiveName = "node-v$Version-win-x64.zip"
$baseUrl = "https://nodejs.org/dist/v$Version"
$archive = Join-Path $cache $archiveName
$checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt").Content
$match = [regex]::Match($checksums, '(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape($archiveName) + '\s*$')
if (!$match.Success) { throw 'Checksum oficial Node nao encontrado.' }
if (!(Test-Path $archive) -or (Get-FileHash $archive -Algorithm SHA256).Hash -ine $match.Groups[1].Value) {
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$archiveName" -OutFile $archive
}
if ((Get-FileHash $archive -Algorithm SHA256).Hash -ine $match.Groups[1].Value) { throw 'SHA256 do runtime Node divergente.' }
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
    foreach ($file in @(@{Source='node.exe';Target='node.exe'},@{Source='LICENSE';Target='LICENSE-Node.txt'})) {
        $entry = $zip.GetEntry("node-v$Version-win-x64/" + $file.Source)
        if (!$entry) { throw ('Arquivo ausente no runtime oficial: ' + $file.Source) }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $runtime $file.Target), $true)
    }
} finally { $zip.Dispose() }
Write-Host "Node $Version preparado com SHA256 oficial conferido."
