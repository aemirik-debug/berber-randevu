#!/usr/bin/env pwsh
# WhatsApp Entegrasyonunu Test Et
# Randevu oluştur -> Berbere bildirim -> Berberin yanıtı -> Müşteri bildirim

Write-Host "🧪 WhatsApp Entegrasyonu Test Ediliyor..." -ForegroundColor Cyan
Write-Host ""

$API = "http://localhost:5001"
$BARBER_PHONE = "05551234567"  # Test berberin numarası
$CUSTOMER_PHONE = "05559876543"  # Test müşteri numarası

# 1. Test: Randevu Oluştur
Write-Host "1️⃣  Randevu Oluşturuluyor..." -ForegroundColor Yellow
$createBody = @{
    customerName = "Test Müşteri"
    customerPhone = $CUSTOMER_PHONE
    barberId = "507f1f77bcf86cd799439011"  # Dummy ID, db'de var olmalı
    services = @("Saç Kesimi", "Sakal Tıraşı")
    notes = "Test randevusu"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$API/api/requests" -Method POST `
        -ContentType "application/json" -Body $createBody -SkipHttpErrorCheck
    
    Write-Host "   Status: $($response.StatusCode)"
    $result = $response.Content | ConvertFrom-Json
    Write-Host "   Yanıt: $($result | ConvertTo-Json -Depth 1)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "2️⃣  Berberin WhatsApp Yanıtı Simüle Ediliyor (Accept)..." -ForegroundColor Yellow

$webhookBody = @{
    phone = $BARBER_PHONE
    action = "accept"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$API/webhook/whatsapp-reply" -Method POST `
        -ContentType "application/json" -Body $webhookBody -SkipHttpErrorCheck
    
    Write-Host "   Status: $($response.StatusCode)"
    $result = $response.Content | ConvertFrom-Json
    Write-Host "   Yanıt: $($result | ConvertTo-Json -Depth 1)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Hata: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Test tamamlandı!" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Kontrol Listesi:" -ForegroundColor Cyan
Write-Host "   ✓ Backend 5001'de çalışıyor mu?"
Write-Host "   ✓ WhatsApp Manager 5205'te çalışıyor mu?"
Write-Host "   ✓ MongoDB bağlı mı?"
Write-Host "   ✓ Berberin numarası (phone) doğru mu?"
