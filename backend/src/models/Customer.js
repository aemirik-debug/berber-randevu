const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String },
  surname: { type: String },
  email: { type: String },
  address: { type: String },
// Randevular
  appointments: [{
    barberName: String,
    date: String,
    time: String,
    service: {
      name: String,
      price: Number,
      duration: Number
    },
    status: { type: String, default: 'pending' }
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