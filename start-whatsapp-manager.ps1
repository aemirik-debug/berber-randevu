#!/usr/bin/env pwsh
# WhatsApp Manager başlat (Port 5205)
# Bu script WEB.js kullanarak WhatsApp'a bağlanır ve mesaj gönderme/almayı sağlar

Write-Host "📱 WhatsApp Manager Başlatılıyor (Port 5205)..." -ForegroundColor Cyan
Write-Host "⚠️  UYARI: İlk kez çalıştırıyorsan, QR kodunu taramanız gerekecek!" -ForegroundColor Yellow

Set-Location "$PSScriptRoot"

# npm dependencies kontrol et
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Bağımlılıklar yükleniyor..." -ForegroundColor Yellow
    npm install
}

Write-Host "✅ WhatsApp Manager başlatıldı (Port 5205). Gitmek için Ctrl+C basın." -ForegroundColor Green
Write-Host "📋 Hatırlatma: Backend (Port 5001) ayrı terminalde çalışmalı!" -ForegroundColor Cyan
node whatsapp-manager.js
