#!/usr/bin/env pwsh
# Backend sunucusunu başlat (Port 5001)

Write-Host "🚀 Backend Sunucusu Başlatılıyor (Port 5001)..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\backend"

# npm dependencies kontrol et
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Bağımlılıklar yükleniyor..." -ForegroundColor Yellow
    npm install
}

Write-Host "✅ Backend başlatıldı. Gitmek için Ctrl+C basın." -ForegroundColor Green
npm run dev
