param(
    [switch]$Headless,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$GhidraArguments
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolchain = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'reverse-tools.json') -Raw | ConvertFrom-Json
$ghidraRoot = Join-Path $projectRoot $toolchain.ghidra.directory
$jdkRoot = Join-Path $projectRoot $toolchain.jdk.directory
$runtimeRoot = Join-Path $PSScriptRoot '.runtime\ghidra'
$launcher = Join-Path $ghidraRoot $(if ($Headless) { 'support\analyzeHeadless.bat' } else { 'ghidraRun.bat' })
if (!(Test-Path -LiteralPath $launcher) -or !(Test-Path -LiteralPath (Join-Path $jdkRoot 'bin\java.exe'))) {
    throw 'Portable Ghidra/JDK is missing. See docs/REVERSE_ENGINEERING_TOOLS.md.'
}
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$previousJavaHome = $env:JAVA_HOME
$previousPath = $env:PATH
$previousJavaOptions = $env:JAVA_TOOL_OPTIONS
$previousGhidraOptions = $env:GHIDRA_JAVA_OPTIONS
try {
    $env:JAVA_HOME = $jdkRoot
    $env:PATH = (Join-Path $jdkRoot 'bin') + ';' + $previousPath
    $projectOptions = '-Duser.home="' + $runtimeRoot + '" -Dapplication.settingsdir="' + $runtimeRoot + '\settings" -Dapplication.cachedir="' + $runtimeRoot + '\cache" -Dapplication.tempdir="' + $runtimeRoot + '\tmp"'
    $env:JAVA_TOOL_OPTIONS = ($previousJavaOptions + ' ' + $projectOptions).Trim()
    $env:GHIDRA_JAVA_OPTIONS = ($previousGhidraOptions + ' ' + $projectOptions).Trim()
    & $launcher @GhidraArguments
    $launcherExitCode = $LASTEXITCODE
} finally {
    $env:JAVA_HOME = $previousJavaHome
    $env:PATH = $previousPath
    $env:JAVA_TOOL_OPTIONS = $previousJavaOptions
    $env:GHIDRA_JAVA_OPTIONS = $previousGhidraOptions
}
exit $launcherExitCode
