$rootDir = Split-Path -Parent $PSScriptRoot

# Set UTF-8 encoding for proper character display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"
$env:NO_COLOR = "1"

# Ensure uv is in PATH
foreach ($uvDir in @(
    "$env:USERPROFILE\.local\bin",
    "$env:APPDATA\Python\Python314\Scripts"
)) {
    if (Test-Path $uvDir) {
        $env:PATH = "$uvDir;$env:PATH"
    }
}

$backendOut = [System.IO.Path]::GetTempFileName()
$backendErr = [System.IO.Path]::GetTempFileName()
$frontendOut = [System.IO.Path]::GetTempFileName()
$frontendErr = [System.IO.Path]::GetTempFileName()

Write-Host "=== Running all tests in parallel ==="

# Use -vv and override addopts so pytest lists each test with PASSED/FAILED/SKIPPED
$backend = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "chcp 65001 >nul && set PATH=$env:PATH && uv run pytest -vv --tb=short --no-header --override-ini=addopts=" `
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

# Parse test counts from summary lines
# Backend pytest: "=== 40 passed, 2 skipped in 0.94s ==="
$backendPassed = 0
$backendFailed = 0
foreach ($line in ($backendClean -split "`n")) {
    if ($line -match "=+\s+(\d+) passed") {
        $backendPassed = [int]$Matches[1]
    }
    if ($line -match "=+\s+(\d+) failed") {
        $backendFailed = [int]$Matches[1]
    }
}

# Vitest: "      Tests  25 passed (25)"
$frontendUnitPassed = 0
$frontendUnitFailed = 0
if ($frontendClean -match "Tests\s+(\d+) passed") { $frontendUnitPassed = [int]$Matches[1] }
if ($frontendClean -match "Tests\s+(\d+) failed") { $frontendUnitFailed = [int]$Matches[1] }

# Playwright: "  6 passed (3.8s)" -- has decimal time, not integer like vitest
$frontendE2EPassed = 0
$frontendE2EFailed = 0
if ($frontendClean -match "(\d+) passed \(\d+\.\d+s\)") { $frontendE2EPassed = [int]$Matches[1] }
if ($frontendClean -match "(\d+) failed \(\d+\.\d+s\)") { $frontendE2EFailed = [int]$Matches[1] }

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

# Build test list from output
$testList = @()

# Backend: "tests/test_foo.py::TestClass::test_name PASSED [ 5%]"
# Paths may use / or \ depending on platform
foreach ($line in ($backendClean -split "`n")) {
    if ($line -match "^tests[/\\](.+?::.+?)\s+(PASSED|FAILED|SKIPPED)") {
        $name = $Matches[1]
        $status = $Matches[2]
        # Shorten: "test_ai_chat.py::TestBuildMessages::test_includes_history" -> "TestBuildMessages::test_includes_history"
        $short = $name -replace '^[^:]+::', ''
        $testList += [PSCustomObject]@{
            Status = $status
            Test   = $short
            Suite  = "Backend (pytest)"
        }
    }
}

# Vitest: lines with checkmark or x, e.g. " ✓ src/lib/kanban.test.ts (3 tests) 4ms"
foreach ($line in ($frontendClean -split "`n")) {
    if ($line -match "^\s+.\s+(\S+\.test\.\S+)\s+\((\d+) tests?\)") {
        $file = $Matches[1] -replace '^src/', ''
        $count = [int]$Matches[2]
        $status = if ($line -match "^\s+x\s") { "FAILED" } else { "PASSED" }
        $testList += [PSCustomObject]@{
            Status = $status
            Test   = "$file ($count tests)"
            Suite  = "Frontend (vitest)"
        }
    }
}

# Playwright: "  ok 1 [chromium] › tests\kanban.spec.ts:9:5 › test name (437ms)"
foreach ($line in ($frontendClean -split "`n")) {
    if ($line -match "^\s+(ok|fail)\s+\d+\s+\[chromium\]") {
        $status = if ($Matches[1] -eq "ok") { "PASSED" } else { "FAILED" }
        # Extract test name: everything after the last separator (› or >) before the timing
        $desc = $line -replace '.*\d+:\d+\s+.?\s+', '' -replace '\s+\(\d+ms\)\s*$', ''
        $desc = $desc.Trim()
        $testList += [PSCustomObject]@{
            Status = $status
            Test   = $desc
            Suite  = "Frontend (playwright)"
        }
    }
}

# Print test list table
Write-Host ""
Write-Host "==========================================="
Write-Host "               TESTS EXECUTED"
Write-Host "==========================================="
Write-Host ("{0,-10} {1,-55} {2}" -f "Status", "Test", "Suite")
Write-Host ("{0,-10} {1,-55} {2}" -f "------", "----", "-----")

foreach ($t in $testList) {
    $color = switch ($t.Status) {
        "PASSED"  { "Green" }
        "FAILED"  { "Red" }
        "SKIPPED" { "Yellow" }
        default   { "White" }
    }
    Write-Host ("{0,-10}" -f $t.Status) -ForegroundColor $color -NoNewline
    Write-Host ("{0,-55} {1}" -f $t.Test, $t.Suite)
}
Write-Host "==========================================="

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
