const cron = require('node-cron');
const Request = require('../models/Request');
const Barber = require('../models/Barber');

const startCronJobs = (io, connectedBarbers) => {
  // Her 5 saniyede bir kontrol et
  cron.schedule('*/5 * * * * *', async () => {
    try {
      const expiredRequests = await Request.find({
        status: 'pending',
        expiresAt: { $lt: new Date() }
      }).populate('barber');

      for (const request of expiredRequests) {
        request.status = 'expired';
        await request.save();
        
        // Müşteriye bildirim
        io.emit(`request_${request._id}_status`, {
          status: 'expired',
          message: '⏰ Süre doldu! Berber yanıt vermedi.'
        });
        
        console.log(`⏰ Talep süresi doldu: ${request._id}`);
      }
    } catch (error) {
      console.error('Cron hatası:', error);
    }
  });

  console.log('⏰ Cron job başlatıldı (5sn aralıkla)');
};

module.exports = { startCronJobs };