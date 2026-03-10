$rootDir = Split-Path -Parent $PSScriptRoot

# Set UTF-8 encoding for proper character display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"
$env:NO_COLOR = "1"

# Ensure uv is in PATH (installed via pip/pipx in user Scripts)
$uvDir = "$env:APPDATA\Python\Python314\Scripts"
if (Test-Path $uvDir) {
    $env:PATH = "$uvDir;$env:PATH"
}

$backendOut = [System.IO.Path]::GetTempFileName()
$backendErr = [System.IO.Path]::GetTempFileName()
$frontendOut = [System.IO.Path]::GetTempFileName()
$frontendErr = [System.IO.Path]::GetTempFileName()

Write-Host "=== Running all tests in parallel ==="

$backend = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "chcp 65001 >nul && uv run pytest --no-header -q" `
    -WorkingDirectory "$rootDir\backend" `
    -NoNewWindow -PassThru `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr

$frontend = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "chcp 65001 >nul && npm run test:all" `
    -WorkingDirectory "$rootDir\frontend" `
    -NoNewWindow -PassThru `
    -RedirectStandardOutput $frontendOut `
    -RedirectStandardError $frontendErr

$backend.WaitForExit()
$frontend.WaitForExit()

$backendOutput = Get-Content $backendOut -Raw -Encoding UTF8
$backendError = Get-Content $backendErr -Raw -Encoding UTF8
$frontendOutput = Get-Content $frontendOut -Raw -Encoding UTF8
$frontendError = Get-Content $frontendErr -Raw -Encoding UTF8

# Combine stdout + stderr for each suite
$backendAll = "$backendOutput`n$backendError"
$frontendAll = "$frontendOutput`n$frontendError"

Write-Host ""
Write-Host "=== Backend tests ==="
if ($backendOutput) { Write-Host $backendOutput }
if ($backendError) { Write-Host $backendError }

Write-Host ""
Write-Host "=== Frontend tests ==="
if ($frontendOutput) { Write-Host $frontendOutput }
if ($frontendError) { Write-Host $frontendError }

Remove-Item $backendOut, $backendErr, $frontendOut, $frontendErr -ErrorAction SilentlyContinue

$backendExit = $backend.ExitCode
$frontendExit = $frontend.ExitCode

# Strip ANSI escape codes before parsing
$ansiRegex = '\x1b\[[0-9;]*[a-zA-Z]'
$backendClean = $backendAll -replace $ansiRegex, ''
$frontendClean = $frontendAll -replace $ansiRegex, ''

# Parse test counts from output
$backendPassed = 0
$backendFailed = 0
if ($backendClean -match "(\d+) passed") { $backendPassed = [int]$Matches[1] }
if ($backendClean -match "(\d+) failed") { $backendFailed = [int]$Matches[1] }

$frontendUnitPassed = 0
$frontendUnitFailed = 0
$frontendE2EPassed = 0
$frontendE2EFailed = 0
if ($frontendClean -match "Tests\s+(\d+) passed") { $frontendUnitPassed = [int]$Matches[1] }
if ($frontendClean -match "Tests\s+(\d+) failed") { $frontendUnitFailed = [int]$Matches[1] }
if ($frontendClean -match "(\d+) passed \(\d+") { $frontendE2EPassed = [int]$Matches[1] }
if ($frontendClean -match "(\d+) failed \(\d+") { $frontendE2EFailed = [int]$Matches[1] }

$totalPassed = $backendPassed + $frontendUnitPassed + $frontendE2EPassed
$totalFailed = $backendFailed + $frontendUnitFailed + $frontendE2EFailed

function Write-TestLine($label, $passed, $failed) {
    Write-Host $label -NoNewline
    Write-Host "$passed passed" -ForegroundColor Green -NoNewline
    Write-Host ", " -NoNewline
    if ($failed -gt 0) {
        Write-Host "$failed failed" -ForegroundColor Red
    } else {
        Write-Host "$failed failed"
    }
}

# Summary
Write-Host ""
Write-Host "==========================================="
Write-Host "               TEST SUMMARY"
Write-Host "==========================================="
Write-TestLine "Backend (pytest):      " $backendPassed $backendFailed
Write-TestLine "Frontend (vitest):     " $frontendUnitPassed $frontendUnitFailed
Write-TestLine "Frontend (playwright): " $frontendE2EPassed $frontendE2EFailed
Write-Host "-------------------------------------------"
Write-TestLine "Total:                 " $totalPassed $totalFailed
Write-Host "==========================================="

# List individual tests that ran
Write-Host ""
Write-Host "Tests executed:"
Write-Host ""

Write-Host "  Backend (pytest):" -ForegroundColor Cyan
foreach ($line in ($backendClean -split "`n")) {
    if ($line -match "^(PASSED|FAILED|ERROR)\s+(.+)" -or $line -match "^(.+)::.+\s+(PASSED|FAILED)") {
        Write-Host "    $line"
    } elseif ($line -match "^\s*(\.+|F+|E+)\s*$" -or $line -match "^tests/") {
        Write-Host "    $line"
    }
}

Write-Host ""
Write-Host "  Frontend (vitest):" -ForegroundColor Cyan
foreach ($line in ($frontendClean -split "`n")) {
    if ($line -match "^\s*(v|x)\s+" -or $line -match "^\s+v\s+" -or $line -match "Test Files\s+\d+") {
        Write-Host "    $line"
    }
}

Write-Host ""
Write-Host "  Frontend (playwright):" -ForegroundColor Cyan
foreach ($line in ($frontendClean -split "`n")) {
    if ($line -match "^\s+(\d+)\s+.*\[chromium\]") {
        Write-Host "    $line"
    }
}

$failed = $false
if ($backendExit -and $backendExit -ne 0) {
    Write-Host "Backend tests FAILED (exit $backendExit)" -ForegroundColor Red
    $failed = $true
}
if ($frontendExit -and $frontendExit -ne 0) {
    Write-Host "Frontend tests FAILED (exit $frontendExit)" -ForegroundColor Red
    $failed = $true
}

if ($failed) { exit 1 }

Write-Host ""
Write-Host "All tests passed." -ForegroundColor Green
