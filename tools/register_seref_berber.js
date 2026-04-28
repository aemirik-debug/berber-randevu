const fetch = require('node-fetch');

fetch('http://localhost:5001/api/barbers/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    barberType: 'male',
    salonName: 'Şeref Berber',
    fullName: 'Berber Şeref',
    phone: '05324074812',
    email: 'seref@example.com',
    address: 'Test Mah. Deneme Cad. No:1',
    city: 'İstanbul',
    district: 'Kadıköy',
    password: 'seref1234'
  })
})
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
