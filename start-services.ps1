# ============================================
# Berber Randevu Sistemi - Hizmetleri Başlat
# ============================================
# Bu script backend, WhatsApp Manager ve
# gerekli tüm servisleri başlatır.

param(
    [switch]$NoWait = $false
)

Write-Host "🚀 Berber Randevu Sistemi Başlatılıyor..." -ForegroundColor Cyan
Write-Host ""

# Backend başlat
Write-Host "📦 Backend servisi başlatılıyor..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "backend"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; node server.js" -PassThru

# 2 saniye bekle
Start-Sleep -Seconds 2

# WhatsApp Manager başlat
Write-Host "💬 WhatsApp Manager başlatılıyor..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; node whatsapp-manager.js" -PassThru

Write-Host ""
Write-Host "✅ Tüm hizmetler başlatıldı!" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Portlar:" -ForegroundColor Cyan
Write-Host "  - Backend API: http://localhost:5001" -ForegroundColor White
Write-Host "  - WhatsApp Manager: http://localhost:5205" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Test etmek için: node tools/scripts/test-whatsapp-flow.js" -ForegroundColor Cyan
Write-Host ""

if (-not $NoWait) {
    Write-Host "⏸️  Ctrl+C ile kapatabilirsiniz." -ForegroundColor Gray
    Read-Host "Devam etmek için Enter'a basın"
}
