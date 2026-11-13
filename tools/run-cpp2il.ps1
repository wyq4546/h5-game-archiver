param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Cpp2ILArguments
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$cpp2ilExe = Join-Path $projectRoot 'integrations\xapk-analyzer\third_party\Cpp2IL\Cpp2IL\bin\Release\net10.0\Cpp2IL.exe'

if (!(Test-Path -LiteralPath $cpp2ilExe)) {
    throw "Cpp2IL.exe not found at $cpp2ilExe. Please check Cpp2IL build."
}

& $cpp2ilExe @Cpp2ILArguments
exit $LASTEXITCODE
