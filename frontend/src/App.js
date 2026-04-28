import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CustomerHome from './pages/CustomerHome';
import BarberLogin from './pages/BarberLogin';
import BarberRegister from './pages/BarberRegister';
import BarberHome from './pages/BarberHome';
import PortalEntry from './pages/PortalEntry';
import CustomerAuth from './components/CustomerAuth';
import BookingPage from './pages/BookingPage';
import 'bootstrap/dist/css/bootstrap.min.css';

function CustomerProtectedRoute({ children }) {
  const token = localStorage.getItem('customerToken');
  const customerInfo = localStorage.getItem('customerInfo');

  if (!token || !customerInfo) {
    return <Navigate to="/customer/auth" replace />;
  }

  return children;
}

function BarberProtectedRoute({ children }) {
  const token = localStorage.getItem('barberToken');
  const barberId = localStorage.getItem('barberId');

  if (!token || !barberId) {
    return <Navigate to="/barber/login" replace />;
  }

  return children;
}


function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Default olarak giriş ekranına yönlendir */}
          <Route path="/" element={<Navigate to="/giris" />} />

          {/* Rol bazli karsilama ve yonlendirme */}
          <Route path="/giris" element={<PortalEntry />} />

          {/* Müşteri giriş/kayıt */}
          <Route path="/customer/auth" element={<CustomerAuth />} />

          {/* Giriş sonrası müşteri ana ekranı */}
          <Route
            path="/customer/home"
            element={(
              <CustomerProtectedRoute>
                <CustomerHome />
              </CustomerProtectedRoute>
            )}
          />

          {/* Berber giriş */}
          <Route path="/barber/login" element={<BarberLogin />} />

          {/* Berber kayıt */}
          <Route path="/barber/register" element={<BarberRegister />} />  
          
          {/* Berber dashboard */}
          <Route
            path="/barber/dashboard"
            element={(
              <BarberProtectedRoute>
                <BarberHome />
              </BarberProtectedRoute>
            )}
          />

          {/* Berber randevu sayfası */}
          <Route
            path="/booking"
            element={(
              <CustomerProtectedRoute>
                <BookingPage />
              </CustomerProtectedRoute>
            )}
          />

        </Routes>
      </div>
    </Router>
  );
}

export default App;