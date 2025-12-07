# 停止 RabbitMQ
$jobIdFile = "$PSScriptRoot\.rabbitmq-job-id.txt"
if (Test-Path $jobIdFile) {
    $jobId = Get-Content $jobIdFile
    Stop-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Job -Id $jobId -ErrorAction SilentlyContinue
    Remove-Item $jobIdFile -ErrorAction SilentlyContinue
    Write-Host "RabbitMQ 已停止" -ForegroundColor Green
} else {
    Write-Host "未找到运行中的 RabbitMQ" -ForegroundColor Yellow
}

# 清理进程
$erlProcesses = Get-Process | Where-Object {$_.ProcessName -eq "erl" -or $_.ProcessName -eq "erlsrv"} -ErrorAction SilentlyContinue
if ($erlProcesses) {
    $erlProcesses | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}