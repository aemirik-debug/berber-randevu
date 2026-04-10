const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String },
  surname: { type: String },
  email: { type: String },
  address: { type: String },
  city: { type: String },
  district: { type: String },
// Randevular
  appointments: [{
    slotId: String,
    barberId: String,
    barberName: String,
    date: String,
    time: String,
    service: {
      name: String,
      price: Number,
      duration: Number
    },
    status: { type: String, default: 'pending' },
    createdAt: Date,
    reminderSentAt: Date,
    cancelReason: String,
    rescheduleApproval: {
      phase: String,
      oldDate: String,
      oldTime: String,
      proposedDate: String,
      proposedTime: String,
      customerDecision: String,
      barberDecision: String,
      requestedAt: Date,
      customerRespondedAt: Date,
      barberRespondedAt: Date
    }
  }],

  // Faturalar
  invoices: [{
    invoiceNumber: String,
    date: Date,
    amount: Number,
    status: String
  }],

  // Favoriler
  favorites: [{
    barberId: String,
    barberName: String,
    district: String,
    phone: String
  }]
});

module.exports = mongoose.model('Customer', customerSchema);