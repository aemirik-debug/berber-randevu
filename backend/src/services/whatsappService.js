const axios = require('axios');

/**
 * WhatsApp Manager API'sine (Port 5205) mesaj gönderme talimatı iletir.
 * @param {string} phone - Berberin sistemdeki 0532... formatındaki numarası
 * @param {string} message - Gönderilecek mesaj içeriği
 */
const sendWhatsappToBarber = async (phone, message) => {
  try {
    // Localde çalışan WhatsApp Manager'a (5205 portu) POST isteği atıyoruz
    const response = await axios.post('http://localhost:5205/send-whatsapp', {
      phone: phone,
      message: message
    });

    console.log('WhatsApp Berbere gönderildi:', response.data);
    return response.data;
  } catch (error) {
    // Eğer Manager açık değilse veya bağlantı hatası varsa buraya düşer
    console.error('WhatsApp Service Berberi Bildir Hatası:', error.message);
    // Hata fırlatmıyoruz, sessizce devam et
    return { success: false, error: error.message };
  }
};

/**
 * Müşteriye WhatsApp bildirim gönder
 * @param {string} phone - Müşterinin 0532... formatındaki numarası
 * @param {string} message - Gönderilecek mesaj içeriği
 */
const sendWhatsappToCustomer = async (phone, message) => {
  try {
    // Localde çalışan WhatsApp Manager'a (5205 portu) POST isteği atıyoruz
    const response = await axios.post('http://localhost:5205/send-whatsapp', {
      phone: phone,
      message: message
    });

    console.log('WhatsApp Müşteriye gönderildi:', response.data);
    return response.data;
  } catch (error) {
    // Eğer Manager açık değilse veya bağlantı hatası varsa buraya düşer
    console.error('WhatsApp Service Müşteri Bildir Hatası:', error.message);
    // Hata fırlatmıyoruz, sessizce devam et
    return { success: false, error: error.message };
  }
};

module.exports = { sendWhatsappToBarber, sendWhatsappToCustomer };