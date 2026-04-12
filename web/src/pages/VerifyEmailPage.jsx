import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../contexts/AuthContext';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail, resendVerification, isLoading, error, clearError } = useAuthStore();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const email = location.state?.email || '';

  useEffect(() => {
    if (!email) {
      navigate('/register');
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setResendSuccess('');

    if (!code || code.length !== 6) {
      setLocalError('6 haneli kod gereklidir');
      return;
    }

    const result = await verifyEmail(code);
    if (result.success) {
      // Email verified, redirect to login
      navigate('/login', { state: { message: 'Email verified! Please login.' } });
    } else {
      setLocalError(result.error);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setLocalError('');
    setResendSuccess('');
    clearError();

    const result = await resendVerification();
    setResendLoading(false);

    if (result.success) {
      setResendSuccess('Doğrulama kodu yeniden gönderildi');
    } else {
      setLocalError(result.error || 'Kod gönderme başarısız oldu');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-blue-700 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2">ReelUsta</h1>
          <p className="text-gray-600 text-center mb-2">Email Doğrula</p>
          <p className="text-gray-500 text-center text-sm mb-8">
            {email} adresine doğrulama kodu gönderildi
          </p>

          {(error || localError) && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error || localError}
            </div>
          )}

          {resendSuccess && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              {resendSuccess}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">Doğrulama Kodu</label>
              <input
                type="text"
                maxLength="6"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''));
                  setLocalError('');
                }}
                className="w-full px-4 py-3 text-center text-2xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold tracking-widest"
                placeholder="000000"
                disabled={isLoading}
              />
              <p className="text-gray-500 text-xs mt-2">6 haneli kodu giriniz</p>
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Doğrulanıyor...' : 'Doğrula'}
            </button>
          </form>

          <div className="mt-6 border-t pt-4">
            <p className="text-gray-600 text-center mb-3">Kod gelmediyse?</p>
            <button
              onClick={handleResend}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
              disabled={resendLoading}
            >
              {resendLoading ? 'Gönderi yapılıyor...' : 'Kodu Yeniden Gönder'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <Link to="/login" className="text-blue-600 hover:text-blue-800 text-sm">
              Giriş sayfasına dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
