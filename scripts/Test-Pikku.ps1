param(
    [string]$OutputDirectory = "D:\Downloads"
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$report = Join-Path $OutputDirectory "Pikku_Check_$stamp.txt"
$results = [System.Collections.Generic.List[object]]::new()

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
Set-Location $repo
Start-Transcript -Path $report -Force | Out-Null

function Invoke-PikkuCheck {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host "`n===== $Name =====" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    $passed = $true
    $detail = "OK"

    try {
        & $Action
        if ($LASTEXITCODE -ne 0) {
            $passed = $false
            $detail = "退出码 $LASTEXITCODE"
        }
    }
    catch {
        $passed = $false
        $detail = $_.Exception.Message
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    $results.Add([pscustomobject]@{
        Check  = $Name
        Result = if ($passed) { "PASS" } else { "FAIL" }
        Detail = $detail
    })
}

try {
    Invoke-PikkuCheck "仓库与分支" {
        Get-Location
        git status -sb
        git branch --show-current
        git log -3 --oneline
    }

    Invoke-PikkuCheck "Node 与 npm" {
        node --version
        npm.cmd --version
    }

    Invoke-PikkuCheck "依赖目录" {
        if (-not (Test-Path ".\node_modules")) {
            npm.cmd ci
        }
        else {
            Write-Host "node_modules 已存在，跳过 npm ci。"
        }
    }

    Invoke-PikkuCheck "TypeScript" {
        npm.cmd run lint
    }

    Invoke-PikkuCheck "Cloudflare 生产构建" {
        $previousAuthMode = $env:NEXT_PUBLIC_AUTH_MODE
        try {
            $env:NEXT_PUBLIC_AUTH_MODE = "supabase"
            & ".\node_modules\.bin\next.cmd" build
            $buildExitCode = $LASTEXITCODE
        }
        finally {
            if ($null -eq $previousAuthMode) {
                Remove-Item Env:NEXT_PUBLIC_AUTH_MODE -ErrorAction SilentlyContinue
            }
            else {
                $env:NEXT_PUBLIC_AUTH_MODE = $previousAuthMode
            }
        }
        $global:LASTEXITCODE = $buildExitCode
    }

    Invoke-PikkuCheck "Git 格式" {
        git diff --check
    }

    Invoke-PikkuCheck "最终工作区" {
        git status -sb
        git diff --stat
        git diff -- next-env.d.ts
    }

    Write-Host "`n===== 汇总 =====" -ForegroundColor Cyan
    $results | Format-Table -AutoSize
    $failed = @($results | Where-Object Result -eq "FAIL")
    Write-Host "通过：$($results.Count - $failed.Count)；失败：$($failed.Count)"
}
finally {
    Stop-Transcript | Out-Null
}

Write-Host "`n检查已全部运行。报告：$report" -ForegroundColor Green
