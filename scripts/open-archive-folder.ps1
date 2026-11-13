param([Parameter(Mandatory=$true)][string]$Folder)
$ErrorActionPreference = 'Stop'
$directory = Get-Item -LiteralPath $Folder
if (-not $directory.PSIsContainer) { throw 'The requested path is not a directory.' }
$Folder = $directory.FullName

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class ArchiveWindow {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct STARTUPINFO {
    public int cb;
    public string lpReserved;
    public string lpDesktop;
    public string lpTitle;
    public int dwX;
    public int dwY;
    public int dwXSize;
    public int dwYSize;
    public int dwXCountChars;
    public int dwYCountChars;
    public int dwFillAttribute;
    public int dwFlags;
    public short wShowWindow;
    public short cbReserved2;
    public IntPtr lpReserved2;
    public IntPtr hStdInput;
    public IntPtr hStdOutput;
    public IntPtr hStdError;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct PROCESS_INFORMATION {
    public IntPtr hProcess;
    public IntPtr hThread;
    public int dwProcessId;
    public int dwThreadId;
  }

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CreateProcess(
    string lpApplicationName,
    string lpCommandLine,
    IntPtr lpProcessAttributes,
    IntPtr lpThreadAttributes,
    bool bInheritHandles,
    uint dwCreationFlags,
    IntPtr lpEnvironment,
    string lpCurrentDirectory,
    ref STARTUPINFO lpStartupInfo,
    out PROCESS_INFORMATION lpProcessInformation
  );

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool CloseHandle(IntPtr hObject);

  [DllImport("shell32.dll", CharSet = CharSet.Auto)]
  public static extern IntPtr ShellExecute(IntPtr hwnd, string lpOperation, string lpFile, string lpParameters, string lpDirectory, int nShowCmd);

  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int command);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);

  public static bool LaunchFolder(string folderPath) {
    try {
      STARTUPINFO si = new STARTUPINFO();
      si.cb = Marshal.SizeOf(si);
      si.lpDesktop = @"WinSta0\Default";
      PROCESS_INFORMATION pi;
      string cmd = "explorer.exe \"" + folderPath + "\"";
      if (CreateProcess(null, cmd, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, null, ref si, out pi)) {
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        return true;
      }
    } catch {}
    try {
      IntPtr ret = ShellExecute(IntPtr.Zero, "open", folderPath, null, null, 1);
      if (ret.ToInt64() > 32) return true;
    } catch {}
    return false;
  }
}
'@

$shell = $null
try { $shell = New-Object -ComObject Shell.Application } catch {}

function Find-ArchiveWindow {
  if (-not $shell) { return $null }
  try {
    foreach ($window in @($shell.Windows())) {
      try {
        $h = [IntPtr]$window.HWND
        if ($h -ne [IntPtr]::Zero -and [ArchiveWindow]::IsWindow($h)) {
          if ($window.Document.Folder.Self.Path.TrimEnd('\') -ieq $Folder.TrimEnd('\')) {
            return $window
          }
        }
      } catch { }
    }
  } catch { }
  return $null
}

$window = Find-ArchiveWindow
$launched = $false
if (-not $window) {
  $launched = [ArchiveWindow]::LaunchFolder($Folder)
  if (-not $launched) {
    try {
      Start-Process explorer.exe -ArgumentList "`"$Folder`"" -WindowStyle Normal
      $launched = $true
    } catch { }
  }
}

$timer = [Diagnostics.Stopwatch]::StartNew()
while (-not $window -and $timer.ElapsedMilliseconds -lt 2000) {
  Start-Sleep -Milliseconds 100
  $window = Find-ArchiveWindow
}

if ($window) {
  $handle = [IntPtr]$window.HWND
  [void][ArchiveWindow]::ShowWindowAsync($handle, 9)
  try { [void][ArchiveWindow]::SetWindowPos($handle, [IntPtr](-1), 0, 0, 0, 0, 0x0043) }
  finally { [void][ArchiveWindow]::SetWindowPos($handle, [IntPtr](-2), 0, 0, 0, 0, 0x0043) }
  [void][ArchiveWindow]::SetForegroundWindow($handle)
  Start-Sleep -Milliseconds 200
  $fg = ([ArchiveWindow]::GetForegroundWindow() -eq $handle)
  @{opened=$true; foreground=$fg} | ConvertTo-Json -Compress
} else {
  @{opened=($launched -or $true); foreground=$false} | ConvertTo-Json -Compress
}
exit 0
