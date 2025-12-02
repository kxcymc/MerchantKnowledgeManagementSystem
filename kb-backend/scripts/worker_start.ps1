# RabbitMQ Worker 启动脚本
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  启动 RabbitMQ Worker" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录的父目录（项目根目录）
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot

Write-Host "检查环境..." -ForegroundColor Yellow

# 检查 .env 文件
if (-not (Test-Path ".env")) {
    Write-Host "✗ 未找到 .env 文件" -ForegroundColor Red
    Write-Host "请先复制 env.example 为 .env 并配置" -ForegroundColor Yellow
    exit 1
}

# 检查 RabbitMQ 配置
Write-Host "检查 RabbitMQ 配置..." -ForegroundColor Yellow
$envContent = Get-Content .env -Raw
if ($envContent -notmatch "RABBIT_URL") {
    Write-Host "✗ 未配置 RABBIT_URL" -ForegroundColor Red
    Write-Host "请在 .env 文件中配置 RabbitMQ 连接地址" -ForegroundColor Yellow
    exit 1
}

Write-Host "启动 Worker 进程..." -ForegroundColor Yellow
Write-Host "Worker 将消费队列中的任务..." -ForegroundColor Cyan
Write-Host ""

node src/queue/worker.js

