param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$AssetRipperArguments
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$assetRipperExe = Join-Path $PSScriptRoot 'AssetRipper\AssetRipper.GUI.Free.exe'

if (!(Test-Path -LiteralPath $assetRipperExe)) {
    throw "AssetRipper executable not found at $assetRipperExe."
}

& $assetRipperExe @AssetRipperArguments
exit $LASTEXITCODE
