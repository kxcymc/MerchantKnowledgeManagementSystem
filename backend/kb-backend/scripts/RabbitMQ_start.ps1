# 快速启动 RabbitMQ（不使用 Windows 服务）
$env:ERLANG_HOME = "E:\Tools\Erlang OTP"
$env:RABBITMQ_HOME = "E:\Tools\RabbitMQ\rabbitmq_server-4.1.5"
$env:PATH = "$env:ERLANG_HOME\bin;$env:PATH"

$sbin = "$env:RABBITMQ_HOME\sbin"
Set-Location $sbin

# 停止服务（如果运行）
& ".\rabbitmq-service.bat" stop 2>&1 | Out-Null
Start-Sleep -Seconds 2

# 清理进程
$erlProcesses = Get-Process | Where-Object {$_.ProcessName -eq "erl" -or $_.ProcessName -eq "erlsrv"} -ErrorAction SilentlyContinue
if ($erlProcesses) {
    $erlProcesses | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
}

# 后台启动
$job = Start-Job -ScriptBlock {
    param($sbinPath, $erlangHome, $rabbitmqHome)
    $env:ERLANG_HOME = $erlangHome
    $env:RABBITMQ_HOME = $rabbitmqHome
    $env:PATH = "$erlangHome\bin;$env:PATH"
    Set-Location $sbinPath
    & ".\rabbitmq-server.bat"
} -ArgumentList $sbin, $env:ERLANG_HOME, $env:RABBITMQ_HOME

Write-Host "RabbitMQ 正在启动..." -ForegroundColor Green
Write-Host "后台任务 ID: $($job.Id)" -ForegroundColor Gray

# 等待启动
for ($i = 0; $i -lt 30; $i++) {
    $p1 = Get-NetTCPConnection -LocalPort 5672 -ErrorAction SilentlyContinue
    if ($p1) {
        Write-Host "✓ RabbitMQ 已启动！" -ForegroundColor Green
        Write-Host "管理界面: http://localhost:15672" -ForegroundColor Cyan
        break
    }
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
}
Write-Host ""

# 保存 job ID 到文件，方便停止
$job.Id | Out-File "$PSScriptRoot\.rabbitmq-job-id.txt" -Force