const router = require('express').Router();
const controller = require('../controllers/requestController');
const auth = require('../middleware/authMiddleware');

// Public routes
router.post('/', controller.createRequest);

// Protected routes (sadece berberler)
router.get('/pending', auth, controller.getPendingRequests);
router.get('/:requestId', auth, controller.getRequestById); // Randevu detayını getir
router.patch('/:requestId/respond', auth, controller.respondToRequest);
router.patch('/:requestId/complete', auth, controller.completeRequest);
router.patch('/:requestId/cancel', auth, controller.cancelRequest);

module.exports = router;
