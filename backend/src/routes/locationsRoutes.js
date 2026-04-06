const express = require('express');
const router = express.Router();
const provinces = require('../data/turkiye-il-ilce.json');

// İller
router.get('/cities', (req, res) => {
  const cities = provinces.map(p => p.name);
  res.json(cities);
});

// İlçeler
router.get('/districts/:city', (req, res) => {
  const city = provinces.find(p => p.name === req.params.city);
  if (!city) return res.status(404).json({ message: 'İl bulunamadı' });
  res.json(city.districts);
});

module.exports = router;