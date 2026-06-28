# start.ps1 -- Start all Lawyerly services with labeled, colour-coded output.
# Blocks until Ctrl+C; on exit kills every spawned process and stops Docker.
#
# Usage:  .\start.ps1
#         npm run start:all
#
# Ports: core-api :4000 | web :3000 | admin-web :3100 | ai-svc :8000
#        Postgres :5433  | MinIO :9000 (API)  :9001 (console)

#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$Root    = $PSScriptRoot
$TmpDir  = Join-Path $env:TEMP 'lawyerly-dev'
$PidFile = Join-Path $TmpDir 'pids.json'
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

$LabelColors = @{
    'infra'     = 'Cyan'
    'core-api'  = 'Green'
    'web'       = 'Blue'
    'admin-web' = 'Magenta'
    'ai-svc'    = 'Yellow'
}

function Write-Label([string]$Name, [string]$Text, [string]$Color = '') {
    $c = if ($Color) { $Color } elseif ($LabelColors[$Name]) { $LabelColors[$Name] } else { 'White' }
    Write-Host ("  [{0,-9}] " -f $Name) -ForegroundColor $c -NoNewline
    Write-Host $Text
}

function Strip-Ansi([string]$s) {
    [regex]::Replace($s, '\x1B\[[0-9;]*[A-Za-z]', '')
}

# Read lines appended to a log file since a given byte offset.
# Returns @($lines, $newOffset).
function Read-NewLines([string]$Path, [long]$From) {
    try {
        $fi = [System.IO.FileInfo]::new($Path)
        $fi.Refresh()
        if ($fi.Length -le $From) { return @($null, $From) }
        $fs = [System.IO.FileStream]::new(
            $Path,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::ReadWrite)
        $fs.Position = $From
        $sr  = [System.IO.StreamReader]::new($fs)
        $buf = $sr.ReadToEnd()
        $end = $fs.Position
        $sr.Dispose(); $fs.Dispose()
        $lines = $buf -split "`r?`n" | Where-Object { $_.Trim() -ne '' }
        return @($lines, $end)
    } catch {
        return @($null, $From)
    }
}

# Returns the PID of the process listening on a TCP port, or 0 if none.
function Get-PortPid([int]$Port) {
    $result = netstat -ano 2>$null | Select-String "\s+[:.]$Port\s+.*LISTENING"
    if ($result) {
        foreach ($line in $result) {
            if ($line -match '\s+(\d+)\s*$') { return [int]$Matches[1] }
        }
    }
    return 0
}

# ---------------------------------------------------------------------------
# 0. Pre-flight: kill stale service processes + reset the temp log folder.
#    Runs unconditionally so "start.ps1 twice in a row" always works cleanly
#    and the "file is being used by another process" error can never occur.
# ---------------------------------------------------------------------------

Write-Host ''
Write-Label 'infra' 'Pre-flight: checking for stale processes on service ports ...'

$ServicePorts = @(3000, 3100, 4000, 8000)
$anyKilled    = $false
foreach ($port in $ServicePorts) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        $ownerPid = ($conns | Select-Object -First 1).OwningProcess
        if ($ownerPid -gt 4) {
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            Write-Label 'infra' "Killed PID $ownerPid on :$port"
            $anyKilled = $true
        }
    }
}

if ($anyKilled) {
    Write-Label 'infra' 'Waiting 2 s for file handles to release ...'
    Start-Sleep 2
} else {
    Write-Label 'infra' 'No stale processes found.'
}

# Delete and recreate the log folder so no process can hold a file open.
if (Test-Path $TmpDir) {
    Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
Write-Label 'infra' 'Log folder ready.'

# ---------------------------------------------------------------------------
# 1. Docker — ensure Docker Desktop (or daemon) is running
# ---------------------------------------------------------------------------

Write-Host ''
Write-Label 'infra' 'Checking Docker daemon ...'
$dockerReady = $false
for ($attempt = 1; $attempt -le 2; $attempt++) {
    $info = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }

    if ($attempt -eq 1) {
        # Try to start Docker Desktop (installed at E:\Docker on this machine)
        $desktopExe = 'E:\Docker\Docker Desktop.exe'
        if (Test-Path $desktopExe) {
            Write-Label 'infra' 'Starting Docker Desktop (waiting up to 45 s) ...'
            Start-Process $desktopExe -ErrorAction SilentlyContinue
            $deadline2 = (Get-Date).AddSeconds(45)
            while ((Get-Date) -lt $deadline2) {
                Start-Sleep 3
                if ((docker info 2>&1 | Out-String) -notmatch 'error|cannot connect') { break }
            }
        } else {
            Write-Label 'infra' 'Docker daemon not running. Start Docker and re-run start.ps1.' 'Red'
            exit 1
        }
    }
}
if (-not $dockerReady) {
    Write-Label 'infra' 'Docker daemon did not start in time. Check Docker Desktop.' 'Red'
    exit 1
}
Write-Label 'infra' 'Docker daemon ready.'

Write-Label 'infra' 'docker compose up -d ...'
Push-Location $Root
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Label 'infra' 'docker compose failed -- aborting.' 'Red'
    Pop-Location; exit 1
}
Pop-Location

Write-Label 'infra' 'Waiting for Postgres (up to 60 s) ...'
$deadline = (Get-Date).AddSeconds(60)
$dbReady  = $false
while ((Get-Date) -lt $deadline) {
    if ((docker exec lawyerly-db pg_isready -U lawyerly -d lawyerly 2>&1) -match 'accepting') {
        $dbReady = $true; break
    }
    Start-Sleep 2
}
if (-not $dbReady) {
    Write-Label 'infra' 'ERROR: Postgres not ready after 60 s.' 'Red'
    Push-Location $Root; docker compose down | Out-Null; Pop-Location
    exit 1
}
Write-Label 'infra' 'Postgres :5433 ready  |  MinIO :9000 ready'

# ---------------------------------------------------------------------------
# 2. Service definitions
#    Each service writes a tiny .bat launcher so we avoid quoting && inside PS
#    strings and keep the PS parser happy. Start-Process runs each .bat via the
#    default .bat handler (cmd.exe) with stdout/stderr redirected to log files.
#
#    NOTE: ai-svc uses "python -m uvicorn" because the uvicorn.exe in the
#    Python Scripts directory is not on cmd.exe's PATH. python.exe IS on PATH
#    via C:\Users\Administrator\AppData\Local\Python\bin.
# ---------------------------------------------------------------------------

$Services = [ordered]@{
    'core-api'  = @{ Dir = 'apps\core-api';  Port = 4000
        Bat = "@echo off`r`nset NO_COLOR=1`r`nset FORCE_COLOR=0`r`nnpm run dev"
    }
    'web'       = @{ Dir = 'apps\web';        Port = 3000
        Bat = "@echo off`r`nset NO_COLOR=1`r`nset FORCE_COLOR=0`r`nnpm run dev"
    }
    'admin-web' = @{ Dir = 'apps\admin-web';  Port = 3100
        Bat = "@echo off`r`nset NO_COLOR=1`r`nset FORCE_COLOR=0`r`nnpm run dev"
    }
    'ai-svc'    = @{ Dir = 'apps\ai-service'; Port = 8000
        Bat = "@echo off`r`nset PYTHONUNBUFFERED=1`r`nset PYTHONDONTWRITEBYTECODE=1`r`npython -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    }
}

# ---------------------------------------------------------------------------
# 3. Port-in-use check (warn and skip if a service is already running)
# ---------------------------------------------------------------------------

$SkipServices = @{}
foreach ($name in $Services.Keys) {
    $port = $Services[$name].Port
    $pid_ = Get-PortPid $port
    if ($pid_ -gt 0) {
        Write-Label $name "Port :$port already in use (PID $pid_) -- skipping." 'Yellow'
        $SkipServices[$name] = $true
    }
}

# ---------------------------------------------------------------------------
# 4. Launch processes
# ---------------------------------------------------------------------------

$Procs    = [ordered]@{}   # name -> Process
$LogSpecs = [ordered]@{}   # name -> list of @{File;Offset}
$PidMap   = @{}
$Reported = @{}            # name -> $true once crash has been printed

foreach ($name in $Services.Keys) {
    if ($SkipServices[$name]) { continue }

    $svc     = $Services[$name]
    $workDir = Join-Path $Root $svc.Dir

    # Write a launcher batch file for this service
    $batFile = Join-Path $TmpDir "$name.bat"
    $svc.Bat | Set-Content -Path $batFile -Encoding ASCII

    $outFile = Join-Path $TmpDir "$name-out.log"
    $errFile = Join-Path $TmpDir "$name-err.log"
    '' | Set-Content $outFile   # create / clear
    '' | Set-Content $errFile

    $proc = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', $batFile `
        -WorkingDirectory $workDir `
        -RedirectStandardOutput $outFile `
        -RedirectStandardError  $errFile `
        -NoNewWindow -PassThru

    $Procs[$name]    = $proc
    $LogSpecs[$name] = @(
        @{ File = $outFile; Offset = 0L }
        @{ File = $errFile; Offset = 0L }
    )
    $PidMap[$name] = $proc.Id
    $Reported[$name] = $false
    Write-Label $name "Started  (PID $($proc.Id))"
}

# Save PIDs so stop.ps1 can clean up from another terminal
$PidMap | ConvertTo-Json | Set-Content $PidFile

# ---------------------------------------------------------------------------
# 5. Banner
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host '  +-------------------------------------------------+' -ForegroundColor White
Write-Host '  |  Lawyerly dev -- all services running           |' -ForegroundColor White
Write-Host '  |                                                 |' -ForegroundColor White
Write-Host '  |  Web (user)     ->  http://localhost:3000       |' -ForegroundColor White
Write-Host '  |  Admin panel    ->  http://localhost:3100       |' -ForegroundColor White
Write-Host '  |  Core API       ->  http://localhost:4000       |' -ForegroundColor White
Write-Host '  |  AI service     ->  http://localhost:8000       |' -ForegroundColor White
Write-Host '  |  MinIO console  ->  http://localhost:9001       |' -ForegroundColor White
Write-Host '  |                                                 |' -ForegroundColor White
Write-Host '  |  Ctrl+C to stop all                            |' -ForegroundColor White
Write-Host '  +-------------------------------------------------+' -ForegroundColor White
Write-Host ''

# ---------------------------------------------------------------------------
# 6. Tail loop -- stream labeled output to console
# ---------------------------------------------------------------------------

try {
    while ($true) {
        $anyRunning = $false
        foreach ($name in $LogSpecs.Keys) {
            $proc = $Procs[$name]
            if ($proc.HasExited) {
                if (-not $Reported[$name]) {
                    $Reported[$name] = $true
                    # Flush remaining log output before printing the crash notice
                    foreach ($spec in $LogSpecs[$name]) {
                        $result      = Read-NewLines $spec.File $spec.Offset
                        $lines       = $result[0]
                        $spec.Offset = $result[1]
                        if ($lines) {
                            foreach ($line in $lines) { Write-Label $name (Strip-Ansi $line) }
                        }
                    }
                    Write-Label $name "EXITED unexpectedly (code $($proc.ExitCode)) -- stopping all services." 'Red'
                    Write-Host ''
                    # Trigger the finally block to clean up
                    throw "Service '$name' exited unexpectedly with code $($proc.ExitCode)."
                }
            } else {
                $anyRunning = $true
                foreach ($spec in $LogSpecs[$name]) {
                    $result      = Read-NewLines $spec.File $spec.Offset
                    $lines       = $result[0]
                    $spec.Offset = $result[1]
                    if ($lines) {
                        foreach ($line in $lines) {
                            Write-Label $name (Strip-Ansi $line)
                        }
                    }
                }
            }
        }
        if (-not $anyRunning -and $Procs.Count -gt 0) { break }
        Start-Sleep -Milliseconds 150
    }
} finally {
    # ---------------------------------------------------------------------------
    # 7. Cleanup on Ctrl+C or error
    # ---------------------------------------------------------------------------
    Write-Host ''
    Write-Label 'infra' 'Stopping all services ...' 'White'
    foreach ($name in $Procs.Keys) {
        taskkill /F /T /PID $Procs[$name].Id 2>&1 | Out-Null
        Write-Label $name 'Stopped.'
    }
    Push-Location $Root
    Write-Label 'infra' 'docker compose down ...'
    docker compose down
    Pop-Location
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
    Write-Label 'infra' 'Done.' 'White'
    Write-Host ''
}
