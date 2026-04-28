const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = 5205;

app.use(bodyParser.json());

// WhatsApp İstemcisi
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true, // Sunucuya taşırken true kalsın, local testte hata alırsan false yapabilirsin
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

// QR Kodu Terminalde Göster
client.on('qr', (qr) => {
    console.log('\n--- LÜTFEN QR KODU TARATIN ---');
    qrcode.generate(qr, { small: true });
});

// Bağlantı Kurulduğunda
client.on('ready', () => {
    console.log('\n✅ Berbergo Sistemi Bağlandı!');
    console.log(`WhatsApp Manager HTTP API ${PORT} portunda dinleniyor.`);
});

// Basit Test: "ping" yazınca "pong" cevabı
client.on('message', async (msg) => {
    if (msg.body.toLowerCase() === 'ping') {
        msg.reply('pong! Berbergo sistemi aktif çalışıyor.');
    }
});

// Berbere WhatsApp mesajı gönderme fonksiyonu (Numara formatı düzeltildi)
async function sendAppointmentToBarber(barberPhone, message) {
    // 1. Numara içindeki boşluk, parantez gibi sayı olmayan her şeyi temizle
    let cleaned = barberPhone.replace(/\D/g, '');

    // 2. Eğer numara 0 ile başlıyorsa (0532...), 0'ı atıp başına 90 ekle
    if (cleaned.startsWith('0')) {
        cleaned = '90' + cleaned.substring(1);
    } 
    // 3. Eğer numara 0 ile başlamıyor ama başında 90 da yoksa (532...), başına 90 ekle
    else if (!cleaned.startsWith('90')) {
        cleaned = '90' + cleaned;
    }

    const whatsappId = `${cleaned}@c.us`;
    
    console.log(`Mesaj iletiliyor: ${whatsappId}`);
    await client.sendMessage(whatsappId, message);
}

// POST /send-whatsapp
app.post('/send-whatsapp', async (req, res) => {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'phone ve message zorunlu' });
    }

    // WhatsApp bağlantısı hazır mı kontrolü
    if (!client.info || !client.info.wid) {
        return res.status(503).json({ success: false, error: 'WhatsApp bağlantısı henüz hazır değil.' });
    }

    try {
        await sendAppointmentToBarber(phone, message);
        res.json({ success: true });
    } catch (err) {
        console.error('Mesaj gönderme hatası:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Gelen onay/iptal yanıtlarını dinleme
client.on('message', async (msg) => {
    const body = msg.body.trim().toLowerCase();
    
    if (body === 'onayla' || body === 'iptal') {
        const action = body === 'onayla' ? 'accept' : 'reject';
        
        // WhatsApp ID'den (905xx...) numara kısmını al
        let phone = msg.from.replace('@c.us', '');
        
        // Backend'in anlayacağı 05xx formatına geri çevir
        if (phone.startsWith('90')) {
            phone = '0' + phone.slice(2);
        }

        try {
            await axios.post('http://localhost:5001/webhook/whatsapp-reply', {
                phone,
                action
            });
            console.log(`Yanıt backend'e iletildi: ${phone} - ${action}`);
        } catch (err) {
            console.error('Webhook gönderim hatası:', err.message);
        }
    }
});

client.initialize();

app.listen(PORT);