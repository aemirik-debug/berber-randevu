import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './PortalEntry.css';

function PortalEntry() {
  const revealRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealRef.current.forEach((item) => {
      if (item) {
        observer.observe(item);
      }
    });

    return () => observer.disconnect();
  }, []);

  const setRevealRef = (element) => {
    if (element && !revealRef.current.includes(element)) {
      revealRef.current.push(element);
    }
  };

  return (
    <main className="portal-page">
      <nav className="navbar navbar-expand-lg fixed-top portal-nav">
        <div className="container">
          <a className="navbar-brand portal-brand" href="#giris">
            <span className="portal-brand-mark"><i className="bi bi-scissors" /></span>
            Berber Randevu
          </a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#portalNav" aria-controls="portalNav" aria-expanded="false" aria-label="Menüyü aç/kapat">
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="portalNav">
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-2">
              <li className="nav-item"><a className="nav-link portal-nav-link" href="#nasil-calisir">Nasıl Çalışır?</a></li>
              <li className="nav-item"><a className="nav-link portal-nav-link" href="#giris">Giriş Yap</a></li>
              <li className="nav-item ms-lg-3"><a className="btn btn-sm portal-cta-link" href="#giris">Hemen Başla</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="portal-hero">
        <div className="container position-relative">
          <div className="row align-items-center">
            <div className="col-lg-8 portal-hero-content">
              <div className="portal-badge" ref={setRevealRef}>
                <i className="bi bi-stars" /> Profesyonel Berber Sistemi
              </div>
              <h1 className="portal-title" ref={setRevealRef}>
                Randevu, Takvim ve<br />Müşteri İletişimi<br /><span className="portal-title-accent">Tek Merkezde</span>
              </h1>
              <p className="portal-subtitle" ref={setRevealRef}>
                Bu panelde berberler günlük operasyonu yönetir, müşteriler uygun saatleri seçip hızlı şekilde randevu oluşturur.
                Giriş türünü seçerek ilgili deneyime geçiş yapabilirsiniz.
              </p>
              <div className="d-flex flex-wrap gap-3" ref={setRevealRef}>
                <a href="#giris" className="portal-btn portal-btn-primary">
                  <i className="bi bi-rocket-takeoff" /> Hemen Başla
                </a>
                <a href="#nasil-calisir" className="portal-btn portal-btn-outline">
                  <i className="bi bi-play-circle" /> Nasıl Çalışır?
                </a>
              </div>
            </div>
            <div className="col-lg-4 d-none d-lg-block">
              <div className="portal-hero-illustration">
                <i className="bi bi-calendar-check portal-hero-icon" />
              </div>
            </div>
          </div>
        </div>
        <div className="portal-scroll-indicator">
          <a href="#giris"><i className="bi bi-chevron-double-down" /></a>
        </div>
      </section>

      <section className="portal-stats">
        <div className="container">
          <div className="row">
            <div className="col-6 col-md-3 portal-stat" ref={setRevealRef}>
              <span className="portal-stat-number">500+</span>
              <span className="portal-stat-label">Aktif Berber</span>
            </div>
            <div className="col-6 col-md-3 portal-stat" ref={setRevealRef}>
              <span className="portal-stat-number">50K+</span>
              <span className="portal-stat-label">Randevu/Ay</span>
            </div>
            <div className="col-6 col-md-3 portal-stat" ref={setRevealRef}>
              <span className="portal-stat-number">%98</span>
              <span className="portal-stat-label">Memnuniyet</span>
            </div>
            <div className="col-6 col-md-3 portal-stat" ref={setRevealRef}>
              <span className="portal-stat-number">7/24</span>
              <span className="portal-stat-label">Destek</span>
            </div>
          </div>
        </div>
      </section>

      <section className="portal-login-section" id="giris">
        <div className="container">
          <h2 className="portal-section-title text-center" ref={setRevealRef}>Giriş Türünü Seçin</h2>
          <p className="portal-section-subtitle text-center" ref={setRevealRef}>Rolünüze göre uygun panele erişin</p>

          <div className="row g-4 justify-content-center">
            <div className="col-lg-5 col-md-6" ref={setRevealRef}>
              <div className="portal-login-card portal-login-barber">
                <div className="portal-card-icon">✂️</div>
                <h3 className="portal-card-title">Berber Girişi</h3>
                <p className="portal-card-subtitle">İşletme yönetimi ve günlük kontrol merkezi</p>

                <ul className="portal-feature-list">
                  <li><i className="bi bi-check-circle-fill" /> Takvimde slot açma, kapatma ve saat yönetimi</li>
                  <li><i className="bi bi-check-circle-fill" /> Randevu onaylama, erteleme ve iptal akışı</li>
                  <li><i className="bi bi-check-circle-fill" /> Günlük ve aylık performans özeti</li>
                  <li><i className="bi bi-check-circle-fill" /> Hizmetler, fiyatlar ve mağaza ayarları</li>
                  <li className="portal-shop-line">
                    <i className="bi bi-bag-fill portal-shop-icon" />
                    <strong>BerberShop:</strong> Toptan malzeme ve alet edevat alışverişi
                    <span className="portal-shop-badge">Yeni</span>
                  </li>
                  <li className="portal-subline"><i className="bi bi-arrow-right" /> Makas, traş makineleri, taraklar, şampuanlar</li>
                  <li className="portal-subline"><i className="bi bi-arrow-right" /> Boyalar, aksesuarlar ve sarf malzemeler</li>
                  <li className="portal-subline"><i className="bi bi-arrow-right" /> Özel berber fiyatlarıyla toptan satın alım</li>
                </ul>

                <div className="d-grid gap-2">
                  <Link to="/barber/login" className="portal-btn portal-btn-primary">
                    <i className="bi bi-box-arrow-in-right" /> Berber Olarak Giriş Yap
                  </Link>
                  <a href="/" className="portal-btn portal-btn-shop">
                    <i className="bi bi-bag" /> BerberShop'a Git
                  </a>
                </div>
              </div>
            </div>

            <div className="col-lg-5 col-md-6" ref={setRevealRef}>
              <div className="portal-login-card portal-login-customer">
                <div className="portal-card-icon portal-card-icon-customer">💈</div>
                <h3 className="portal-card-title">Müşteri Girişi</h3>
                <p className="portal-card-subtitle portal-card-subtitle-customer">Hızlı randevu ve takip deneyimi</p>

                <ul className="portal-feature-list">
                  <li><i className="bi bi-check-circle-fill portal-customer-icon" /> Uygun berber ve saat seçimi</li>
                  <li><i className="bi bi-check-circle-fill portal-customer-icon" /> Randevu oluşturma ve durum takibi</li>
                  <li><i className="bi bi-check-circle-fill portal-customer-icon" /> Hatırlatmalar ve değişiklik bildirimleri</li>
                  <li><i className="bi bi-check-circle-fill portal-customer-icon" /> Tek ekrandan giriş veya kayıt işlemi</li>
                </ul>

                <Link to="/customer/auth" className="portal-btn portal-btn-outline portal-btn-customer-outline w-100 justify-content-center">
                  <i className="bi bi-person" /> Müşteri Olarak Giriş Yap
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="portal-how-it-works" id="nasil-calisir">
        <div className="container">
          <h2 className="portal-section-title text-center" ref={setRevealRef}>Sistem Nasıl Çalışır?</h2>
          <p className="portal-section-subtitle text-center" ref={setRevealRef}>4 adımda kusursuz randevu deneyimi</p>

          <div className="row g-4">
            <div className="col-md-3" ref={setRevealRef}>
              <div className="portal-step-card">
                <div className="portal-step-number">1</div>
                <h4 className="portal-step-title">Hesap Girişi</h4>
                <p className="portal-step-desc">Rolünüze göre berber veya müşteri girişini seçersiniz.</p>
              </div>
            </div>
            <div className="col-md-3" ref={setRevealRef}>
              <div className="portal-step-card">
                <div className="portal-step-number">2</div>
                <h4 className="portal-step-title">Randevu Planı</h4>
                <p className="portal-step-desc">Berber takvim açarken müşteri uygun saatten talep oluşturur.</p>
              </div>
            </div>
            <div className="col-md-3" ref={setRevealRef}>
              <div className="portal-step-card">
                <div className="portal-step-number">3</div>
                <h4 className="portal-step-title">Onay ve İletişim</h4>
                <p className="portal-step-desc">Onay, iptal ve değişiklikler taraflara anlık yansıtılır.</p>
              </div>
            </div>
            <div className="col-md-3" ref={setRevealRef}>
              <div className="portal-step-card">
                <div className="portal-step-number">4</div>
                <h4 className="portal-step-title">Operasyon Takibi</h4>
                <p className="portal-step-desc">Berber paneli ile günlük durum ve performans sürekli izlenir.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="portal-free-cta">
        <div className="container text-center" ref={setRevealRef}>
          <h2>Hemen <span className="portal-title-accent">Ücretsiz</span> Başlayın</h2>
          <p>Kredi kartı gerekmez. 14 gün ücretsiz deneme ile sistemin tüm özelliklerini keşfedin.</p>
          <div className="d-flex flex-wrap justify-content-center gap-3">
            <a href="#giris" className="portal-btn portal-btn-primary portal-btn-wide">
              <i className="bi bi-rocket" /> Ücretsiz Hesap Oluştur
            </a>
          </div>
        </div>
      </section>

      <footer className="portal-footer">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-4 text-center text-md-start mb-3 mb-md-0">
              <div className="portal-footer-logo"><i className="bi bi-scissors" /> Berber Randevu</div>
              <p className="portal-footer-text">Profesyonel berber yönetim sistemi</p>
            </div>
            <div className="col-md-4 text-center mb-3 mb-md-0">
              <div className="portal-social-links">
                <a href="https://instagram.com" target="_blank" rel="noreferrer"><i className="bi bi-instagram" /></a>
                <a href="https://facebook.com" target="_blank" rel="noreferrer"><i className="bi bi-facebook" /></a>
                <a href="https://x.com" target="_blank" rel="noreferrer"><i className="bi bi-twitter-x" /></a>
                <a href="https://linkedin.com" target="_blank" rel="noreferrer"><i className="bi bi-linkedin" /></a>
              </div>
            </div>
            <div className="col-md-4 text-center text-md-end">
              <p className="portal-footer-text mb-0">© 2026 Berber Randevu. Tüm hakları saklıdır.</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default PortalEntry;
