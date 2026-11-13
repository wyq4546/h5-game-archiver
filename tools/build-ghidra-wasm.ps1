$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolchain = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'reverse-tools.json') -Raw | ConvertFrom-Json
$ghidraRoot = Join-Path $projectRoot $toolchain.ghidra.directory
$jdkRoot = Join-Path $projectRoot $toolchain.jdk.directory
$gradle = Join-Path $projectRoot ($toolchain.gradle.directory + '\bin\gradle.bat')
$pluginRoot = Join-Path $projectRoot $toolchain.wasmPlugin.sourceDirectory
$previousJavaHome = $env:JAVA_HOME
$previousPath = $env:PATH
$previousGradleHome = $env:GRADLE_USER_HOME
try {
    $env:JAVA_HOME = $jdkRoot
    $env:PATH = (Join-Path $jdkRoot 'bin') + ';' + $previousPath
    $env:GRADLE_USER_HOME = Join-Path $PSScriptRoot '.runtime\gradle'
    & $gradle --no-daemon --console=plain -p $pluginRoot "-PGHIDRA_INSTALL_DIR=$ghidraRoot" buildExtension
    $buildExitCode = $LASTEXITCODE
} finally {
    $env:JAVA_HOME = $previousJavaHome
    $env:PATH = $previousPath
    $env:GRADLE_USER_HOME = $previousGradleHome
}
if ($buildExitCode -ne 0) { exit $buildExitCode }
$extensionZip = Get-ChildItem -LiteralPath (Join-Path $pluginRoot 'dist') -Filter '*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$extensionZip) { throw 'No extension package was produced.' }
$extensionRoot = Join-Path $ghidraRoot 'Ghidra\Extensions'
Expand-Archive -LiteralPath $extensionZip.FullName -DestinationPath $extensionRoot -Force
Write-Output ('Installed extension: ' + $extensionZip.Name)
