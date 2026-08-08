param(
    [string]$OutputDirectory = "D:\Downloads"
)

# Keep this file ASCII-only for Windows PowerShell 5.1 compatibility.
$ErrorActionPreference = "Continue"
$previousConsoleEncoding = [Console]::OutputEncoding
$previousOutputEncoding = $OutputEncoding
$utf8Encoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8Encoding
$OutputEncoding = $utf8Encoding
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$report = Join-Path $OutputDirectory "Pikku_Check_$stamp.txt"
$results = @()

function Write-Section {
    param([string]$Name)
    Write-Host "`n===== $Name =====" -ForegroundColor Cyan
}

function Invoke-LoggedCommand {
    param([scriptblock]$Command)

    $global:LASTEXITCODE = 0
    & $Command 2>&1 | ForEach-Object { Write-Host $_ }
    return [int]$LASTEXITCODE
}

function Add-Result {
    param(
        [string]$Name,
        [int]$Code
    )

    $status = "PASS"
    if ($Code -ne 0) {
        $status = "FAIL"
    }

    $script:results += [pscustomobject]@{
        Check = $Name
        Result = $status
        ExitCode = $Code
    }
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
Set-Location $repo
Start-Transcript -Path $report -Force | Out-Null

Write-Section "Repository"
Write-Host (Get-Location).Path
$repositoryCode = Invoke-LoggedCommand { git status -sb }
$currentCode = Invoke-LoggedCommand { git branch --show-current }
if ($currentCode -ne 0) { $repositoryCode = $currentCode }
$currentCode = Invoke-LoggedCommand { git log -3 --oneline }
if ($currentCode -ne 0) { $repositoryCode = $currentCode }
Add-Result "Repository" $repositoryCode

Write-Section "Node and npm"
$environmentCode = Invoke-LoggedCommand { node --version }
$currentCode = Invoke-LoggedCommand { npm.cmd --version }
if ($currentCode -ne 0) { $environmentCode = $currentCode }
Add-Result "Node and npm" $environmentCode

Write-Section "Dependencies"
$dependencyCode = 0
if (Test-Path ".\node_modules") {
    Write-Host "node_modules exists; npm ci skipped."
}
else {
    $dependencyCode = Invoke-LoggedCommand { npm.cmd ci }
}
Add-Result "Dependencies" $dependencyCode

Write-Section "TypeScript"
$typeScriptCode = Invoke-LoggedCommand { npm.cmd run lint }
Add-Result "TypeScript" $typeScriptCode

Write-Section "Worker unit tests"
$testCode = Invoke-LoggedCommand { node --disable-warning=ExperimentalWarning --test tests/wechat-oauth.test.mjs tests/vocabulary-adaptive.test.mjs tests/vocabulary-migration.test.mjs tests/content-review.test.mjs }
Add-Result "Worker unit tests" $testCode

Write-Section "Cloudflare production build"
$previousAuthMode = $env:NEXT_PUBLIC_AUTH_MODE
$env:NEXT_PUBLIC_AUTH_MODE = "supabase"
$buildCode = Invoke-LoggedCommand { & ".\node_modules\.bin\next.cmd" build }
if ($null -eq $previousAuthMode) {
    Remove-Item Env:NEXT_PUBLIC_AUTH_MODE -ErrorAction SilentlyContinue
}
else {
    $env:NEXT_PUBLIC_AUTH_MODE = $previousAuthMode
}
Add-Result "Cloudflare production build" $buildCode

Write-Section "Git formatting"
$formatCode = Invoke-LoggedCommand { git diff --check }
Add-Result "Git formatting" $formatCode

Write-Section "Final worktree"
$worktreeCode = Invoke-LoggedCommand { git status -sb }
$null = Invoke-LoggedCommand { git diff --stat }
$null = Invoke-LoggedCommand { git diff -- next-env.d.ts }
Add-Result "Final worktree" $worktreeCode

Write-Section "Summary"
$results | Format-Table -AutoSize
$failed = @($results | Where-Object Result -eq "FAIL")
Write-Host "Passed: $($results.Count - $failed.Count); Failed: $($failed.Count)"
Write-Host "Report: $report"

Stop-Transcript | Out-Null
[Console]::OutputEncoding = $previousConsoleEncoding
$OutputEncoding = $previousOutputEncoding
Write-Host "`nAll checks finished. Report: $report" -ForegroundColor Green
