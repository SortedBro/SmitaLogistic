const express   = require('express');
const router    = express.Router();
const Settings  = require('../models/Settings');
const adminAuth = require('../middleware/adminAuth');

// ── GET Settings Page ─────────────────────────
router.get('/', adminAuth, async (req, res) => {
  const s = await Settings.getAll();
  res.render('pages/admin-settings', {
    title  : 'Settings — SmitaLogistic Admin',
    page   : 'admin',
    admin  : req.session.adminName,
    settings: s,
    success: req.flash('success'),
    error  : req.flash('error')
  });
});

// ── SAVE Settings ─────────────────────────────
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      fixedMargin, pctMargin,
      adminPhone, businessName,
      whatsappApiKey
    } = req.body;

    await Promise.all([
      Settings.set('fixedMargin',   parseFloat(fixedMargin)  || 50),
      Settings.set('pctMargin',     parseFloat(pctMargin)    || 0),
      Settings.set('adminPhone',    adminPhone    || ''),
      Settings.set('businessName',  businessName  || 'SmitaLogistic'),
      Settings.set('whatsappApiKey',whatsappApiKey || ''),
    ]);

    req.flash('success', '✅ Settings save ho gayi!');
    res.redirect('/admin/settings');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/settings');
  }
});

// ── API: Get current pricing (for JS fetch) ───
router.get('/pricing', adminAuth, async (req, res) => {
  const s = await Settings.getAll();
  res.json({
    fixedMargin: parseFloat(s.fixedMargin ?? 50),
    pctMargin  : parseFloat(s.pctMargin   ?? 0)
  });
});

module.exports = router;