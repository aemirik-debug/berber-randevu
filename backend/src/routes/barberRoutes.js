const router = require('express').Router();
const express = require('express');
const controller = require('../controllers/barberController');
const authMiddleware = require('../middleware/authMiddleware');
const Barber = require('../models/Barber');

// Public routes
router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/nearby', controller.getNearby);
router.get('/', async (req, res) => { try { const { district } = req.query; let query = {}; if (district) { query.district = district; } const barbers = await Barber.find(query); res.json(barbers); } catch (error) { res.status(500).json({ success: false, error: error.message }); } });
// Protected routes
router.get('/profile', authMiddleware, controller.getProfile);
router.patch('/profile', authMiddleware, controller.updateProfile);
router.patch('/profile/password', authMiddleware, controller.changePassword);
// services management
router.get('/services', authMiddleware, controller.getServices);
router.post('/services', authMiddleware, controller.addService);
router.put('/services/:serviceId', authMiddleware, controller.updateService);
router.delete('/services/:serviceId', authMiddleware, controller.deleteService);

// Bölgeye göre berber bul (PROTECTED)
router.get('/byDistrict', authMiddleware, async (req, res) => {
  try {
    const { city, district } = req.query;
    const barbers = await Barber.find({ city, district });
    res.json(barbers);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;