const mongoose = require('mongoose');

const BarberSchema = new mongoose.Schema({
  barberType: { type: String, enum: ['male', 'female'], required: true },
  salonName: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  facebookUrl: { type: String, default: '' },
  instagramUrl: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  password: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true, default: [0, 0] }
  },
  subscription: {
    plan: { type: String, default: 'basic' },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    autoRenew: { type: Boolean, default: false }
  },
  features: {
    calendarBooking: { type: Boolean, default: false }
  },
  // çalışma saatleri gün bazında yapılandırılabilir
  workingHours: {
    monday: {
      isOpen: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    tuesday: {
      isOpen: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    wednesday: {
      isOpen: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    thursday: {
      isOpen: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    friday: {
      isOpen: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    saturday: {
      isOpen: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    sunday: {
      isOpen: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    }
  },
  services: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      duration: { type: Number, default: 0 } // dakikayla
    }
  ],
  masters: [
    {
      name: { type: String, required: true, trim: true },
      specialty: { type: String, default: '', trim: true },
      username: { type: String, required: true, trim: true, lowercase: true },
      passwordHash: { type: String, required: true },
      permissions: {
        home: { type: Boolean, default: true },
        calendar: { type: Boolean, default: true },
        services: { type: Boolean, default: false },
        stats: { type: Boolean, default: false },
        settings: { type: Boolean, default: false },
        masters: { type: Boolean, default: false }
      },
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  reviews: [
    {
      customerId: { type: String, required: true },
      customerName: { type: String, default: 'Müşteri' },
      rating: { type: Number, min: 1, max: 5, required: true },
      comment: { type: String, default: '' },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('Barber', BarberSchema);