const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Admin Token Doğrulama
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkisiz erişim' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.adminId) {
      return res.status(401).json({ error: 'Admin token gerekli' });
    }
    req.admin = decoded;
    req.adminId = decoded.adminId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
};

// Belirli izne sahip olup olmadığını kontrol et
const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const admin = await Admin.findById(req.adminId);
      
      if (!admin || !admin.isActive) {
        return res.status(403).json({ error: 'Admin hesabı deaktif' });
      }

      // Süper admin'in tüm izinleri var
      if (admin.isSuperAdmin) {
        return next();
      }

      // İzin kontrolü
      const hasPermission = admin.permissions[resource]?.[action];
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: `${resource} - ${action} işlemi yapma izniniz yok` 
        });
      }

      req.admin = admin;
      next();
    } catch (err) {
      res.status(500).json({ error: 'İzin kontrolü hatası' });
    }
  };
};

// Sadece Super Admin
const superAdminOnly = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.adminId);
    
    if (!admin || !admin.isSuperAdmin) {
      return res.status(403).json({ error: 'Sadece Super Admin işlem yapabilir' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Doğrulama hatası' });
  }
};

module.exports = { adminAuth, requirePermission, superAdminOnly };
