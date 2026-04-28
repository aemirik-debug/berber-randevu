const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Barber = require('./backend/src/models/Barber');
  const Customer = require('./backend/src/models/Customer');
  
  const barber = await Barber.findOne({ phone: '05324074812' });
  const customer = await Customer.findOne({ phone: '05354966205' });
  
  console.log('BARBER:', barber ? barber._id : 'Yok');
  console.log('CUSTOMER:', customer ? customer._id : 'Yok');
  
  if (barber && customer) {
    console.log('SERVICE:', barber.services ? barber.services.length : 'Service yok');
  }
  
  mongoose.connection.close();
}).catch(e => console.error('DB Error:', e.message));
