import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function BarberList() {
  const [district, setDistrict] = useState('');
  const [barbers, setBarbers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBarbers = async () => {
      try {
        // Backend 5001 portunda çalışıyor
        const res = await axios.get('http://localhost:5001/api/barbers', { params: { district } });
        setBarbers(res.data);
      } catch (err) {
        alert('Berberler yüklenemedi: ' + (err.response?.data?.message || err.message));
      }
    };
    fetchBarbers();
  }, [district]);

  return (
    <div>
      <h2>Berberler</h2>
      <select onChange={e => setDistrict(e.target.value)}>
        <option value="">Tüm İlçeler</option>
        <option value="Ataşehir">Ataşehir</option>
        <option value="Kadıköy">Kadıköy</option>
        <option value="Üsküdar">Üsküdar</option>
        {/* diğer ilçeler */}
      </select>

      <ul>
        {barbers.map(barber => (
          <li key={barber._id}>
            {barber.name} - {barber.district}
            <button onClick={() => navigate(`/appointment/${barber._id}`)}>
              Randevu Al
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default BarberList;