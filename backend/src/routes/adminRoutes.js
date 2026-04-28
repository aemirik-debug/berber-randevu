const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminAuth, requirePermission, superAdminOnly } = require('../middleware/adminMiddleware');

// ==================== AUTH ====================
router.post('/login', adminController.adminLogin);

// Middleware: Tüm route'lar admin auth gerekli
router.use(adminAuth);

// ==================== DASHBOARD ====================
router.get('/dashboard/stats', adminController.getDashboardStats);

// ==================== ADMIN YÖNETİMİ ====================
router.get('/admins', superAdminOnly, adminController.getAllAdmins);
router.post('/admins/create', superAdminOnly, adminController.createAdmin);
router.put('/admins/permissions', superAdminOnly, adminController.updateAdminPermissions);
router.delete('/admins/:id', superAdminOnly, adminController.deleteAdmin);

// ==================== MÜŞTERİ YÖNETİMİ ====================
router.get('/customers', requirePermission('customers', 'view'), adminController.getAllCustomers);
router.get('/customers/:id', requirePermission('customers', 'view'), adminController.getCustomerDetail);
router.post('/customers/ban', requirePermission('customers', 'ban'), adminController.banCustomer);

// ==================== BERBER YÖNETİMİ ====================
router.get('/barbers', requirePermission('barbers', 'view'), adminController.getAllBarbers);
router.get('/barbers/:id', requirePermission('barbers', 'view'), adminController.getBarberDetail);
router.post('/barbers/suspend', requirePermission('barbers', 'suspend'), adminController.suspendBarber);
router.post('/barbers/approve', requirePermission('barbers', 'approve'), adminController.approveBarber);

// ==================== RANDEVU YÖNETİMİ ====================
router.get('/appointments', requirePermission('appointments', 'view'), adminController.getAllAppointments);
router.post('/appointments/cancel', requirePermission('appointments', 'cancel'), adminController.cancelAppointment);

// ==================== RAPORLAR ====================
router.get('/reports/revenue', requirePermission('reports', 'view'), adminController.getRevenueReport);

// ==================== AKTIVITE ====================
router.get('/activity-log', adminController.getActivityLog);

module.exports = router;
