const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: [true, 'Müşteri adı zorunlu']
  },
  customerPhone: {
    type: String,
    required: [true, 'Müşteri telefonu zorunlu']
  },
  barber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber',
    required: true
  },
  services: [{
    type: String,
    required: true
  }],
  estimatedPrice: {
    type: Number,
    required: true
  },
  estimatedDuration: {
    type: Number, // dakika
    default: 30
  },
  status: {
    type: String,
    enum: [
      'pending',
      'accepted',
      'rejected',
      'expired',
      'completed',
      'cancelled_by_customer',
      'cancelled_by_barber'
    ],
    default: 'pending'
  },
  notes: {
    type: String // Müşteri notu
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  payment: {
  isPaid: { type: Boolean, default: false },
  amount: { type: Number, default: 0 }
},
cancelReason: { type: String }
,
  acceptedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  rejectionReason: String
});

// Süresi dolan talepleri bulmak için indeks
requestSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Request', requestSchema);
