param(
    [string]$OutputDirectory = "D:\Downloads"
)

# Keep this file ASCII-only for Windows PowerShell 5.1 compatibility.
$ErrorActionPreference = "Continue"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$report = Join-Path $OutputDirectory "Pikku_Check_$stamp.txt"
$results = @()

function Write-Section {
    param([string]$Name)
    Write-Host "`n===== $Name =====" -ForegroundColor Cyan
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
Get-Location
git status -sb
$repositoryCode = $LASTEXITCODE
git branch --show-current
if ($LASTEXITCODE -ne 0) { $repositoryCode = $LASTEXITCODE }
git log -3 --oneline
if ($LASTEXITCODE -ne 0) { $repositoryCode = $LASTEXITCODE }
Add-Result "Repository" $repositoryCode

Write-Section "Node and npm"
node --version
$environmentCode = $LASTEXITCODE
npm.cmd --version
if ($LASTEXITCODE -ne 0) { $environmentCode = $LASTEXITCODE }
Add-Result "Node and npm" $environmentCode

Write-Section "Dependencies"
$dependencyCode = 0
if (Test-Path ".\node_modules") {
    Write-Host "node_modules exists; npm ci skipped."
}
else {
    npm.cmd ci
    $dependencyCode = $LASTEXITCODE
}
Add-Result "Dependencies" $dependencyCode

Write-Section "TypeScript"
npm.cmd run lint
$typeScriptCode = $LASTEXITCODE
Add-Result "TypeScript" $typeScriptCode

Write-Section "Cloudflare production build"
$previousAuthMode = $env:NEXT_PUBLIC_AUTH_MODE
$env:NEXT_PUBLIC_AUTH_MODE = "supabase"
& ".\node_modules\.bin\next.cmd" build
$buildCode = $LASTEXITCODE
if ($null -eq $previousAuthMode) {
    Remove-Item Env:NEXT_PUBLIC_AUTH_MODE -ErrorAction SilentlyContinue
}
else {
    $env:NEXT_PUBLIC_AUTH_MODE = $previousAuthMode
}
Add-Result "Cloudflare production build" $buildCode

Write-Section "Git formatting"
git diff --check
$formatCode = $LASTEXITCODE
Add-Result "Git formatting" $formatCode

Write-Section "Final worktree"
git status -sb
$worktreeCode = $LASTEXITCODE
git diff --stat
git diff -- next-env.d.ts
Add-Result "Final worktree" $worktreeCode

Write-Section "Summary"
$results | Format-Table -AutoSize
$failed = @($results | Where-Object Result -eq "FAIL")
Write-Host "Passed: $($results.Count - $failed.Count); Failed: $($failed.Count)"

Stop-Transcript | Out-Null
Write-Host "`nAll checks finished. Report: $report" -ForegroundColor Green
