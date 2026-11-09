$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    Add-Type -Path (Join-Path $PSScriptRoot 'SafeTransfer.cs')
    [Console]::WriteLine('{"ready":true}')
    while ($null -ne ($line = [Console]::ReadLine())) {
        $id = $null
        try {
            $request = $line | ConvertFrom-Json
            $id = $request.id
            $value = $null
            switch ($request.op) {
                'prepare' { $value = [SafeTransfer]::Prepare([string]$request.source, [string]$request.destination, [long]$request.size, [double]$request.mtimeMs, [string]$request.hash) }
                'commit' { $value = [SafeTransfer]::Commit() }
                'abort' { [SafeTransfer]::Abort() }
                'inspect' { $value = [SafeTransfer]::Inspect([string]$request.path) }
                default { throw 'Comando desconhecido.' }
            }
            [Console]::WriteLine((@{id=$id;ok=$true;value=$value} | ConvertTo-Json -Compress -Depth 8))
        } catch {
            $errorObject = $_.Exception
            while ($null -ne $errorObject.InnerException) { $errorObject = $errorObject.InnerException }
            $code = 'native'
            if ($null -ne $errorObject.PSObject.Properties['Code']) { $code = $errorObject.Code }
            [Console]::WriteLine((@{id=$id;ok=$false;code=$code;error=$errorObject.Message} | ConvertTo-Json -Compress -Depth 5))
        }
    }
} catch {
    [Console]::WriteLine((@{fatal=$true;error=$_.Exception.Message} | ConvertTo-Json -Compress))
    exit 1
} finally {
    if ('SafeTransfer' -as [type]) { [SafeTransfer]::Abort() }
}
