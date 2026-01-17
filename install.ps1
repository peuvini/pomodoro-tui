# Pomodoro TUI Installer for Windows
# Run: irm https://raw.githubusercontent.com/treepo1/pomodoro-tui/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "treepo1/pomodoro-tui"
$BinaryName = "pomotui.exe"
$InstallDir = "$env:LOCALAPPDATA\Programs\pomotui"
$AssetName = "pomotui-windows-x64.exe"

Write-Host "Pomodoro TUI Installer" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host "Install directory: $InstallDir"
Write-Host ""

# Create install directory if it doesn't exist
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Get latest release
Write-Host "Fetching latest release..."
$Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
$Version = $Release.tag_name
$Asset = $Release.assets | Where-Object { $_.name -eq $AssetName }

if (-not $Asset) {
    Write-Host "Error: Could not find asset $AssetName" -ForegroundColor Red
    Write-Host "Available assets:"
    $Release.assets | ForEach-Object { Write-Host "  - $($_.name)" }
    exit 1
}

$DownloadUrl = $Asset.browser_download_url

Write-Host "Latest version: $Version"
Write-Host "Downloading from: $DownloadUrl"
Write-Host ""

# Download binary
$TempFile = Join-Path $env:TEMP $BinaryName
Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempFile

# Move to install directory
$InstallPath = Join-Path $InstallDir $BinaryName
Move-Item -Path $TempFile -Destination $InstallPath -Force

# Add to PATH if not already there
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    Write-Host "Adding $InstallDir to PATH..."
    $NewPath = "$UserPath;$InstallDir"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    $env:Path = "$env:Path;$InstallDir"
    Write-Host "PATH updated. You may need to restart your terminal for changes to take effect." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Successfully installed pomotui $Version!" -ForegroundColor Green
Write-Host "Run 'pomotui --help' to get started."
