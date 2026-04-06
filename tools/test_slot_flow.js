(async () => {
  const API = 'http://localhost:5001/api';
  const today = new Date().toISOString().split('T')[0];
  const fetch = global.fetch || (await import('node-fetch')).default;
  const io = (await import('socket.io-client')).default;

  const random = Math.floor(Math.random()*9000)+1000;
  const barberPhone = `999900${random}`;
  const barberPass = 'pass1234';

  try {
    console.log('Registering barber...');
    let res = await fetch(`${API}/barbers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barberType: 'male', salonName: 'TestSalon'+random, fullName: 'Test Barber', phone: barberPhone, email: `tb${random}@example.com`, address: 'Addr', city: 'Istanbul', district: 'Kadikoy', password: barberPass })
    });
    const reg = await res.json();
    if (!res.ok) throw new Error('Barber register failed: ' + JSON.stringify(reg));
    console.log('Barber registered:', reg.data?.id);

    console.log('Logging in barber...');
    res = await fetch(`${API}/barbers/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: barberPhone, password: barberPass })
    });
    const login = await res.json();
    if (!res.ok) throw new Error('Barber login failed: ' + JSON.stringify(login));
    const token = login.token;
    console.log('Barber token acquired');

    console.log('Enabling calendarBooking and today workingHours via profile update...');
    // open today's working hours so generate actually creates slots
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const workingHours = {};
    workingHours[dayName] = { isOpen: true, open: '09:00', close: '17:00' };
    res = await fetch(`${API}/barbers/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ features: { calendarBooking: true }, workingHours }) });
    const upd = await res.json();
    console.log('Profile update:', upd.success);

    console.log('Generating slots for today...');
    res = await fetch(`${API}/slots/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ startDate: today, endDate: today }) });
    const gen = await res.json();
    console.log('Slots generated:', gen.count);

    console.log('Fetching my-slots...');
    res = await fetch(`${API}/slots/my-slots?date=${today}`, { headers: { Authorization: `Bearer ${token}` } });
    const my = await res.json();
    if (!my.success) throw new Error('Failed to get slots: ' + JSON.stringify(my));
    const available = my.data.find(s => s.status === 'available');
    if (!available) throw new Error('No available slots found');
    console.log('Found available slot:', available._id, available.time);

    // create customer
    const custPhone = `555100${random}`;
    console.log('Registering customer...', custPhone);
    res = await fetch(`${API}/customers/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: custPhone, password: 'custpass' }) });
    const custReg = await res.json();
    if (!res.ok) throw new Error('Customer register failed: ' + JSON.stringify(custReg));
    const customer = custReg.customer;
    console.log('Customer id:', customer._id);

    // connect socket as customer to listen realtime updates
    console.log('Connecting socket as customer to listen for appointment_update...');
    const socket = io('http://localhost:5001');
    await new Promise((resolve) => socket.on('connect', resolve));
    socket.emit('customer_login', { customerId: customer._id });

    let receivedUpdate = null;
    socket.on('appointment_update', (data) => {
      console.log('Socket received appointment_update:', data);
      receivedUpdate = data;
    });

    console.log('Booking slot as customer...');
    res = await fetch(`${API}/slots/${available._id}/book`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: customer._id, customerPhone: custPhone, customerName: customer.name || 'TestCust', service: 'Test Service' }) });
    const book = await res.json();
    if (!book.success) throw new Error('Booking failed: ' + JSON.stringify(book));
    console.log('Booking response:', book.message, 'customerPush=', book.customerPush);

    console.log('Refreshing barber slots to see booked slot...');
    res = await fetch(`${API}/slots/my-slots?date=${today}`, { headers: { Authorization: `Bearer ${token}` } });
    const my2 = await res.json();
    const booked = my2.data.find(s => s._id === available._id);
    console.log('Slot status after booking:', booked.status);

    console.log('Barber confirming the slot...');
    res = await fetch(`${API}/slots/${available._id}/action`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'confirm' }) });
    const act = await res.json();
    console.log('Action response (full):', act);
    if (!act.success) throw new Error('Action failed: ' + JSON.stringify(act));

    console.log('Final slot status:', act.slot?.status);

    console.log('Fetching customer appointments...');
    res = await fetch(`${API}/customers/appointments/${customer._id}`);
    const apps = await res.json();
    console.log('Customer appointments:', JSON.stringify(apps, null, 2));

    // wait up to 3s for socket appointment_update
    const waited = await new Promise((resolve) => {
      const t = setInterval(() => {
        if (receivedUpdate) {
          clearInterval(t);
          resolve(true);
        }
      }, 100);
      setTimeout(() => { clearInterval(t); resolve(false); }, 3000);
    });

    console.log('Socket update received:', waited, receivedUpdate);

    socket.disconnect();

    console.log('Test flow completed successfully');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();
