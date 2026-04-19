const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer token gerekli' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Sunucu yapılandırma hatası' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { barberId, role }
    req.barberId = decoded.barberId; // Uyumluluk için
    req.customerId = decoded.customerId; // Müşteri route'ları için
    req.masterId = decoded.masterId; // Usta route'ları için
    req.masterPermissions = decoded.permissions || null;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
};