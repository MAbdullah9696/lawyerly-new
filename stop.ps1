# stop.ps1 -- Stop all Lawyerly dev services and Docker infrastructure.
# Reads the PID file written by start.ps1; falls back to port scanning.
#
# Usage:  .\stop.ps1
#         npm run stop:all

#Requires -Version 5.1
$ErrorActionPreference = 'SilentlyContinue'

$Root    = $PSScriptRoot
$PidFile = Join-Path $env:TEMP 'lawyerly-dev\pids.json'

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

function Stop-ByPid([int]$Id) {
    if ($Id -le 0) { return $false }
    try { Get-Process -Id $Id -ErrorAction Stop | Out-Null } catch { return $false }
    taskkill /F /T /PID $Id 2>&1 | Out-Null
    return $true
}

Write-Host ''
Write-Label 'infra' 'Stopping Lawyerly dev services ...' 'White'

# ---------------------------------------------------------------------------
# 1. Use saved PIDs from start.ps1
# ---------------------------------------------------------------------------

if (Test-Path $PidFile) {
    $saved = Get-Content $PidFile -Raw | ConvertFrom-Json
    foreach ($prop in $saved.PSObject.Properties) {
        $name = $prop.Name
        $pid_ = [int]$prop.Value
        $msg  = if (Stop-ByPid $pid_) {
            "Stopped  (PID $pid_)."
        } else {
            "Already stopped (PID $pid_)."
        }
        Write-Label $name $msg
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue

} else {
    # ---------------------------------------------------------------------------
    # 2. Fallback: find processes by listening port
    # ---------------------------------------------------------------------------
    Write-Label 'infra' 'No PID file found -- scanning ports.' 'Yellow'
    $PortMap = @{ 4000 = 'core-api'; 3000 = 'web'; 3100 = 'admin-web'; 8000 = 'ai-svc' }

    foreach ($port in $PortMap.Keys) {
        $name  = $PortMap[$port]
        $found = $false
        netstat -ano 2>$null | Select-String "[:.]$port\s" | ForEach-Object {
            if ($_ -match '\s+(\d+)\s*$') {
                $pid_ = [int]$Matches[1]
                if ($pid_ -gt 4 -and (Stop-ByPid $pid_)) { $script:found = $true }
            }
        }
        Write-Label $name (if ($found) { "Stopped (port :$port)." } else { "Nothing on :$port." })
    }
}

# ---------------------------------------------------------------------------
# 3. Docker Compose
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Continue'
Push-Location $Root
Write-Label 'infra' 'docker compose down ...'
docker compose down
Pop-Location
$ErrorActionPreference = 'SilentlyContinue'

# ---------------------------------------------------------------------------
# 4. Port sweep — catches lingering processes the PID file may have missed
#    (e.g., child processes spawned by cmd.exe launchers)
# ---------------------------------------------------------------------------

Write-Label 'infra' 'Port sweep ...'
$SweepPorts = @(3000, 3100, 4000, 8000)
foreach ($port in $SweepPorts) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        $ownerPid = ($conns | Select-Object -First 1).OwningProcess
        if ($ownerPid -gt 4) {
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            Write-Label 'infra' "Swept PID $ownerPid off :$port"
        }
    }
}

# ---------------------------------------------------------------------------
# 5. Remove temp log folder — next start.ps1 recreates it clean
# ---------------------------------------------------------------------------

$TmpDir = Join-Path $env:TEMP 'lawyerly-dev'
if (Test-Path $TmpDir) {
    Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Label 'infra' 'Log folder removed.'
}

Write-Label 'infra' 'All done.' 'White'
Write-Host ''
