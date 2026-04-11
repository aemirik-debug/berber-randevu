const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  barber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber',
    required: true
  },
  date: {
    type: String, // "2026-02-22" formatında
    required: true
  },
  time: {
    type: String, // "14:00" formatında
    required: true
  },
  status: {
    type: String,
    enum: [
      'available',
      'booked',
      'blocked',
      'home-service',
      'confirmed',
      'cancelled',
      'reschedule_pending_customer',
      'reschedule_pending_barber'
    ],
    default: 'available'
  },
  // Dolu slotlar için müşteri bilgisi
  customer: {
    customerId: mongoose.Schema.Types.ObjectId,
    phone: String,
    name: String,
    service: String,
    notes: String,
    isHomeService: { type: Boolean, default: false },
    address: String,        // Yerinde hizmet için
    distance: Number,       // KM cinsinden
    totalPrice: Number      // Hesaplanan toplam fiyat
  },
  // Berber tarafından manuel oluşturulan randevu bilgileri
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  manualPrice: {
    type: Number,
    default: null
  },
  isManualAppointment: {
    type: Boolean,
    default: false  // Berber manuel oluşturursa true, müşteriden gelirse false
  },
  isHistoricalRecord: {
    type: Boolean,
    default: false
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  hiddenAt: Date,
  hiddenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber'
  },
  payment: {
    isPaid: { type: Boolean, default: false },
    amount: { type: Number, default: 0 }
  },
  cancelReason: String,
  rescheduleApproval: {
    phase: {
      type: String,
      enum: ['idle', 'awaiting_customer', 'awaiting_barber', 'completed', 'rejected_by_customer', 'rejected_by_barber'],
      default: 'idle'
    },
    previousStatus: {
      type: String,
      default: ''
    },
    oldDate: String,
    oldTime: String,
    proposedDate: String,
    proposedTime: String,
    customerDecision: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    barberDecision: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    requestedBy: {
      type: String,
      default: 'barber'
    },
    requestedAt: Date,
    customerRespondedAt: Date,
    barberRespondedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Berber + Tarih + Saat kombinasyonu benzersiz olsun
slotSchema.index({ barber: 1, date: 1, time: 1 }, { unique: true });
slotSchema.index({ barber: 1, date: 1 });

module.exports = mongoose.model('Slot', slotSchema);