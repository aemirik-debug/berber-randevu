import { useState, useEffect } from 'react';
import { useAuthStore } from '../contexts/AuthContext';
import { boostsAPI, leadsAPI, offersAPI, paymentsAPI } from '../api/client';
import Header from '../components/Header';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [boosts, setBoosts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [offers, setOffers] = useState([]);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [boostsRes, leadsRes, offersRes] = await Promise.all([
        boostsAPI.list(),
        leadsAPI.statistics(),
        offersAPI.statistics(),
      ]);

      setBoosts(boostsRes.data);
      setLeads(leadsRes.data);
      setOffers(offersRes.data);

      setStats({
        totalBoosts: boostsRes.data?.length || 0,
        activeBoosts: boostsRes.data?.filter((b) => b.is_active)?.length || 0,
        totalLeads: leadsRes.data?.total_leads || 0,
        convertedLeads: leadsRes.data?.converted_leads || 0,
        conversionRate: leadsRes.data?.conversion_rate || 0,
        offersSent: offersRes.data?.total_offers || 0,
        offersAccepted: offersRes.data?.accepted_offers || 0,
      });
    } catch (error) {
      console.error('Dashboard data loading failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated || user?.role !== 'professional') {
    return <div>Sadece profesyoneller dashboard'a erişebilir</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header user={user} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Profesyonel Dashboard</h1>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-gray-300">
          {['overview', 'boosts', 'leads', 'offers', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'overview' && 'Genel Bakış'}
              {tab === 'boosts' && 'Boosts'}
              {tab === 'leads' && 'Leads'}
              {tab === 'offers' && 'Teklifler'}
              {tab === 'payments' && 'Ödemeler'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Toplam Boost" value={stats.totalBoosts} subtext={`${stats.activeBoosts} aktif`} />
            <StatCard label="Toplam Lead" value={stats.totalLeads} subtext={`${stats.convertedLeads} dönüştürüldü`} />
            <StatCard label="Dönüşüm Oranı" value={`${stats.conversionRate?.toFixed(1)}%`} />
            <StatCard label="Gönderilen Teklifler" value={stats.offersSent} subtext={`${stats.offersAccepted} kabul`} />
          </div>
        )}

        {/* Boosts Tab */}
        {activeTab === 'boosts' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Boost'larım</h2>
              {boosts.length > 0 ? (
                <div className="space-y-4">
                  {boosts.map((boost) => (
                    <div key={boost.id} className="border rounded-lg p-4 hover:shadow-lg transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{boost.post?.title || 'Unnamed Boost'}</h3>
                          <p className="text-gray-600 text-sm">Durumu: {boost.is_active ? '🟢 Aktif' : '🔴 İnaktif'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">${boost.metadata?.price || '0'}</p>
                          <p className="text-gray-500 text-sm">{boost.duration_days} gün</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">Henüz boost yok. Bir post boost'la!</p>
              )}
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Leads Analitikleri</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded">
                <p className="text-gray-600 text-sm">Yeni Leads</p>
                <p className="text-3xl font-bold">{leads?.new_leads || 0}</p>
              </div>
              <div className="p-4 bg-green-50 rounded">
                <p className="text-gray-600 text-sm">İletişim Kurulan</p>
                <p className="text-3xl font-bold">{leads?.contacted_leads || 0}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded">
                <p className="text-gray-600 text-sm">Dönüştürülen</p>
                <p className="text-3xl font-bold">{leads?.converted_leads || 0}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded">
                <p className="text-gray-600 text-sm">Ort. İletişim Süresi</p>
                <p className="text-2xl font-bold">{leads?.avg_time_to_contact?.toFixed(1) || '-'} dk</p>
              </div>
            </div>
          </div>
        )}

        {/* Offers Tab */}
        {activeTab === 'offers' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Teklifler</h2>
            <p className="text-gray-600">Teklifler bölümü yakında geliyor...</p>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Ödeme Tarihi</h2>
            <p className="text-gray-600">Ödeme geçmişi bölümü yakında geliyor...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-gray-600 text-sm font-semibold mb-2">{label}</p>
      <p className="text-4xl font-bold text-gray-900 mb-1">{value}</p>
      {subtext && <p className="text-gray-500 text-xs">{subtext}</p>}
    </div>
  );
}
