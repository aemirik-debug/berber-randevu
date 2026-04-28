const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  surname: { type: String, required: true },
  phone: { type: String, default: '' },
  
  // Role ve İzinler
  role: { 
    type: String, 
    enum: ['superadmin', 'admin', 'moderator'], 
    default: 'admin' 
  },
  
  permissions: {
    // Kullanıcı Yönetimi
    users: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      ban: { type: Boolean, default: false }
    },
    // Berber Yönetimi
    barbers: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      suspend: { type: Boolean, default: false }
    },
    // Müşteri Yönetimi
    customers: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      ban: { type: Boolean, default: false }
    },
    // Randevu Yönetimi
    appointments: {
      view: { type: Boolean, default: false },
      cancel: { type: Boolean, default: false },
      modify: { type: Boolean, default: false }
    },
    // Hizmet Yönetimi
    services: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    // Kategori Yönetimi
    categories: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false }
    },
    // Ödeme Yönetimi
    payments: {
      view: { type: Boolean, default: false },
      refund: { type: Boolean, default: false },
      withdraw: { type: Boolean, default: false }
    },
    // Sistem Ayarları
    settings: {
      view: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      manage_admins: { type: Boolean, default: false }
    },
    // Raporlar
    reports: {
      view: { type: Boolean, default: false },
      export: { type: Boolean, default: false }
    },
    // Bildirimler
    notifications: {
      view: { type: Boolean, default: false },
      send: { type: Boolean, default: false },
      manage: { type: Boolean, default: false }
    },
    // Sistem Yönetimi
    system: {
      logs: { type: Boolean, default: false },
      maintenance: { type: Boolean, default: false },
      backup: { type: Boolean, default: false }
    }
  },
  
  // Hesap Durumu
  isActive: { type: Boolean, default: true },
  isSuperAdmin: { type: Boolean, default: false }, // Tüm izinler otomatik verilecek
  
  // Etkinlik Günlüğü
  activityLog: [{
    action: { type: String, required: true }, // 'create', 'update', 'delete', 'ban', vb.
    targetType: { type: String }, // 'user', 'barber', 'customer', vb.
    targetId: { type: String },
    targetName: { type: String },
    details: { type: String },
    ipAddress: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Giriş Bilgileri
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  loginLockedUntil: { type: Date },
  
  // Tarihler
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Password hashing
AdminSchema.pre('save', async function() {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Password karşılaştırma methodu
AdminSchema.methods.comparePassword = async function(inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema);
