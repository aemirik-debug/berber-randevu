const Admin = require('../models/Admin');
const Customer = require('../models/Customer');
const Barber = require('../models/Barber');
const Request = require('../models/Request');
const jwt = require('jsonwebtoken');

// ==================== AUTH ====================

// Admin Giriş
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Admin giriş denemesi:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gerekli' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log('❌ Admin bulunamadı:', email);
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    console.log('✅ Admin bulundu:', email);
    const isPasswordValid = await admin.comparePassword(password);
    console.log('🔑 Password doğrulanması:', isPasswordValid);
    if (!isPasswordValid) {
      admin.loginAttempts = (admin.loginAttempts || 0) + 1;
      if (admin.loginAttempts >= 5) {
        admin.loginLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 dakika kilit
      }
      await admin.save();
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    if (admin.loginLockedUntil && admin.loginLockedUntil > new Date()) {
      return res.status(403).json({ error: 'Çok fazla başarısız giriş. Lütfen 30 dakika sonra tekrar deneyin.' });
    }

    // Giriş başarılı
    admin.lastLogin = new Date();
    admin.loginAttempts = 0;
    admin.loginLockedUntil = null;
    await admin.save();
    console.log('✅ Admin bilgileri güncellendi');

    const token = jwt.sign(
      { adminId: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('🔑 Token oluşturuldu:', token.substring(0, 20) + '...');

    const responseData = {
      success: true,
      token,
      admin: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isSuperAdmin: admin.isSuperAdmin
      }
    };
    console.log('📤 Response gönderiliyor:', { success: true, adminId: admin._id });
    
    res.json(responseData);
  } catch (err) {
    console.error('🔴 LOGIN ERROR:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
};

// ==================== DASHBOARD ====================

exports.getDashboardStats = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalBarbers = await Barber.countDocuments();
    const totalAppointments = await Request.countDocuments();
    
    // Son 7 günün randevu istatistiği
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const appointmentsLast7Days = await Request.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // İptal edilen randevular
    const cancelledAppointments = await Request.countDocuments({ status: 'cancelled' });
    
    // Onaylanmış randevular
    const approvedAppointments = await Request.countDocuments({ status: 'accepted' });

    // Beklemede olan randevular
    const pendingAppointments = await Request.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      stats: {
        totalCustomers,
        totalBarbers,
        totalAppointments,
        appointmentsLast7Days,
        cancelledAppointments,
        approvedAppointments,
        pendingAppointments
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== KULLANICI YÖNETİMİ ====================

exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({}, '-password').sort({ createdAt: -1 });
    res.json({ success: true, data: admins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { email, password, name, surname, role, permissions } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Gerekli alanlar eksik' });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Bu email zaten kullanılıyor' });
    }

    const newAdmin = new Admin({
      email,
      password,
      name,
      surname: surname || '',
      role: role || 'admin',
      permissions: permissions || {},
      isSuperAdmin: role === 'superadmin'
    });

    await newAdmin.save();

    // Log aktivite
    req.admin.activityLog.push({
      action: 'create',
      targetType: 'admin',
      targetId: newAdmin._id,
      targetName: email,
      details: `Yeni admin oluşturuldu: ${email}`
    });
    await req.admin.save();

    res.status(201).json({
      success: true,
      message: 'Admin başarıyla oluşturuldu',
      admin: {
        _id: newAdmin._id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateAdminPermissions = async (req, res) => {
  try {
    const { adminId, permissions } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { permissions },
      { new: true }
    );

    if (!admin) {
      return res.status(404).json({ error: 'Admin bulunamadı' });
    }

    // Log aktivite
    req.admin.activityLog.push({
      action: 'update',
      targetType: 'admin',
      targetId: adminId,
      targetName: admin.email,
      details: 'İzinler güncellendi'
    });
    await req.admin.save();

    res.json({ success: true, message: 'İzinler güncellendi', admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.body;

    const admin = await Admin.findByIdAndDelete(adminId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin bulunamadı' });
    }

    // Log aktivite
    req.admin.activityLog.push({
      action: 'delete',
      targetType: 'admin',
      targetId: adminId,
      targetName: admin.email,
      details: 'Admin hesabı silindi'
    });
    await req.admin.save();

    res.json({ success: true, message: 'Admin silindi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== MÜŞTERİ YÖNETİMİ ====================

exports.getAllCustomers = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    const customers = await Customer.find()
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Customer.countDocuments();

    res.json({
      success: true,
      data: customers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomerDetail = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Müşteri bulunamadı' });
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.banCustomer = async (req, res) => {
  try {
    const { customerId, reason } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      customerId,
      { isBanned: true, banReason: reason, bannedAt: new Date() },
      { new: true }
    );

    // Log aktivite
    req.admin.activityLog.push({
      action: 'ban',
      targetType: 'customer',
      targetId: customerId,
      targetName: customer.phone,
      details: `Müşteri yasaklandı. Sebep: ${reason}`
    });
    await req.admin.save();

    res.json({ success: true, message: 'Müşteri yasaklandı', customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== BERBER YÖNETİMİ ====================

exports.getAllBarbers = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    const barbers = await Barber.find({}, '-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Barber.countDocuments();

    res.json({
      success: true,
      data: barbers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBarberDetail = async (req, res) => {
  try {
    const barber = await Barber.findById(req.params.id);
    if (!barber) {
      return res.status(404).json({ error: 'Berber bulunamadı' });
    }

    res.json({ success: true, data: barber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.suspendBarber = async (req, res) => {
  try {
    const { barberId, reason } = req.body;

    const barber = await Barber.findByIdAndUpdate(
      barberId,
      { isSuspended: true, suspensionReason: reason, suspendedAt: new Date() },
      { new: true }
    );

    // Log aktivite
    req.admin.activityLog.push({
      action: 'suspend',
      targetType: 'barber',
      targetId: barberId,
      targetName: barber.salonName,
      details: `Berber askıya alındı. Sebep: ${reason}`
    });
    await req.admin.save();

    res.json({ success: true, message: 'Berber askıya alındı', barber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.approveBarber = async (req, res) => {
  try {
    const { barberId } = req.body;

    const barber = await Barber.findByIdAndUpdate(
      barberId,
      { isApproved: true, approvedAt: new Date() },
      { new: true }
    );

    // Log aktivite
    req.admin.activityLog.push({
      action: 'approve',
      targetType: 'barber',
      targetId: barberId,
      targetName: barber.salonName,
      details: 'Berber onaylandı'
    });
    await req.admin.save();

    res.json({ success: true, message: 'Berber onaylandı', barber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== RANDEVU YÖNETİMİ ====================

exports.getAllAppointments = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    const appointments = await Request.find()
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Request.countDocuments();

    res.json({
      success: true,
      data: appointments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId, reason } = req.body;

    const appointment = await Request.findByIdAndUpdate(
      appointmentId,
      { status: 'cancelled', cancellationReason: reason, cancelledAt: new Date() },
      { new: true }
    );

    // Log aktivite
    req.admin.activityLog.push({
      action: 'cancel',
      targetType: 'appointment',
      targetId: appointmentId,
      targetName: `Randevu #${appointmentId}`,
      details: `Randevu iptal edildi. Sebep: ${reason}`
    });
    await req.admin.save();

    res.json({ success: true, message: 'Randevu iptal edildi', appointment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== AKTIVITE GÜNLÜĞÜ ====================

exports.getActivityLog = async (req, res) => {
  try {
    const admin = await Admin.findById(req.adminId);
    const log = admin.activityLog.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== RAPORLAR ====================

exports.getRevenueReport = async (req, res) => {
  try {
    // Son 30 gün gelir
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const appointments = await Request.find({
      createdAt: { $gte: thirtyDaysAgo },
      status: 'accepted'
    });

    let totalRevenue = 0;
    appointments.forEach(apt => {
      if (apt.service && apt.service.price) {
        totalRevenue += apt.service.price;
      }
    });

    res.json({
      success: true,
      data: {
        period: '30 gün',
        totalRevenue,
        appointmentCount: appointments.length,
        averagePerAppointment: appointments.length > 0 ? (totalRevenue / appointments.length).toFixed(2) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
