const express    = require('express');
const router     = express.Router();
const axios      = require('axios');
const Order      = require('../models/Order');
const Contact    = require('../models/Contact');
const adminAuth  = require('../middleware/adminAuth');
const delhivery  = require("../config/delhivery");
const { calculateFinalPrice } = require("../config/pricing");

router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('pages/admin-login', { title: 'Admin Login — SmitaLogistic', page: 'admin', error: req.flash('error'), success: req.flash('success') });
});
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true; req.session.adminName = username; res.redirect('/admin');
  } else { req.flash('error', '❌ Galat username ya password.'); res.redirect('/admin/login'); }
});
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });

// DASHBOARD
router.get('/', adminAuth, async (req, res) => {
  try {
    const [total, awaitingApproval, transit, delivered, failed, rejected, unread, newOrders, recentOrders] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ approvalStatus: 'Awaiting Approval' }),
      Order.countDocuments({ status: { $in: ['In Transit', 'Out for Delivery', 'Booked', 'Pickup Scheduled'] } }),
      Order.countDocuments({ status: 'Delivered' }),
      Order.countDocuments({ status: 'Failed' }),
      Order.countDocuments({ approvalStatus: 'Rejected' }),
      Contact.countDocuments({ read: false }),
      Order.find({ approvalStatus: 'Awaiting Approval' }).sort({ createdAt: -1 }).limit(5),
      Order.find().sort({ createdAt: -1 }).limit(8)
    ]);
    res.render('pages/admin-dashboard', {
      title: 'Dashboard — SmitaLogistic Admin', page: 'admin', admin: req.session.adminName,
      stats: { total, awaitingApproval, transit, delivered, failed, rejected, unread },
      newOrders, recentOrders
    });
  } catch (err) {
    res.render('pages/admin-dashboard', { title: 'Dashboard', page: 'admin', admin: req.session.adminName, stats: {}, newOrders: [], recentOrders: [] });
  }
});

// ALL ORDERS
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { status, search, approval, page: pg } = req.query;
    const page = parseInt(pg) || 1; const limit = 20; const skip = (page-1)*limit;
    let query = {};
    if (approval && approval !== 'all') query.approvalStatus = approval;
    if (status && status !== 'all') query.status = status;
    if (search) { query.$or = [{ reference: new RegExp(search,'i') },{ waybill: new RegExp(search,'i') },{ senderName: new RegExp(search,'i') },{ receiverName: new RegExp(search,'i') },{ senderPhone: new RegExp(search,'i') }]; }
    const [orders, total] = await Promise.all([Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(query)]);
    res.render('pages/admin-orders', { title: 'Orders — Admin', page: 'admin', admin: req.session.adminName, orders, total, currentPage: page, totalPages: Math.ceil(total/limit), filter: { status: status||'all', search: search||'', approval: approval||'all' } });
  } catch (err) {
    res.render('pages/admin-orders', { title: 'Orders', page: 'admin', admin: req.session.adminName, orders: [], total: 0, currentPage: 1, totalPages: 1, filter: { status: 'all', search: '', approval: 'all' } });
  }
});

// ORDER DETAIL
router.get('/orders/:id', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/orders'); }
    res.render('pages/admin-order-detail', { title: `Order ${order.reference}`, page: 'admin', admin: req.session.adminName, order, success: req.flash('success'), error: req.flash('error') });
  } catch (err) { res.redirect('/admin/orders'); }
});

// ✅ APPROVE ORDER
router.post('/orders/:id/approve', adminAuth, async (req, res) => {
  try {
    const { finalPrice, adminNote } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/orders'); }
    if (order.approvalStatus === 'Approved') { req.flash('error', '⚠️ Already approved.'); return res.redirect(`/admin/orders/${req.params.id}`); }

    order.approvalStatus = 'Approved';
    order.finalPrice     = parseFloat(finalPrice) || 0;
    order.adminNote      = adminNote || '';
    order.approvedAt     = new Date();
    order.status         = 'Approved';
    await order.save();

    // Delhivery API call
    let waybill = null; let pickupTime = null; let delhiveryError = null;
    try {
      const result = await delhivery.createShipment(order);
      waybill = result.waybill; pickupTime = result.pickupTime;
      order.waybill = waybill; order.status = 'Booked';
      await order.save();
    } catch (apiErr) { delhiveryError = apiErr.message; console.error('Delhivery error:', apiErr.message); }

    // WhatsApp to customer
    const waMsg = waybill
      ? `✅ *SmitaLogistic* — Aapka parcel book ho gaya!\n\n📦 *AWB:* ${waybill}\n📍 *From:* ${order.senderCity} → *To:* ${order.receiverCity}\n💰 *Final Price:* ₹${order.finalPrice}\n🚗 *Pickup:* ${pickupTime || 'Kal subah 10 baje'}\n\nTrack: http://localhost:3000/track\nRef: ${order.reference}\n\n_SmitaLogistic — Powered by Delhivery_`
      : `✅ *SmitaLogistic* — Aapka order approve ho gaya!\n\n📦 Ref: ${order.reference}\n💰 Price: ₹${order.finalPrice}\n📍 ${order.senderCity} → ${order.receiverCity}\n\nAWB jaldi milega.\n📞 ${process.env.ADMIN_PHONE || '8167045246'}\n\n_SmitaLogistic_`;

    await sendWhatsApp(order.senderPhone, waMsg);
    order.notifiedCustomer = true;
    await order.save();

    req.flash(delhiveryError ? 'error' : 'success',
      delhiveryError
        ? `⚠️ Approved & WhatsApp sent, lekin Delhivery error: ${delhiveryError}`
        : `✅ Approved! AWB: ${waybill} | WhatsApp sent to ${order.senderPhone}`
    );
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) { req.flash('error', err.message); res.redirect(`/admin/orders/${req.params.id}`); }
});

// ❌ REJECT ORDER
router.post('/orders/:id/reject', adminAuth, async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) { req.flash('error', 'Order not found'); return res.redirect('/admin/orders'); }
    order.approvalStatus  = 'Rejected';
    order.status          = 'Rejected';
    order.rejectedAt      = new Date();
    order.rejectionReason = rejectionReason || 'Admin ne reject kiya.';
    await order.save();

    const waMsg = `❌ *SmitaLogistic* — Aapka order accept nahi hua.\n\n📦 Ref: ${order.reference}\n📍 ${order.senderCity} → ${order.receiverCity}\n\n*Reason:* ${order.rejectionReason}\n\nDobara book karne ke liye call karein:\n📞 ${process.env.ADMIN_PHONE || '8167045246'}\n\n_SmitaLogistic_`;
    await sendWhatsApp(order.senderPhone, waMsg);
    order.notifiedCustomer = true;
    await order.save();

    req.flash('success', `Order rejected. WhatsApp sent to customer.`);
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) { req.flash('error', err.message); res.redirect(`/admin/orders/${req.params.id}`); }
});

// UPDATE STATUS
router.post('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { status, waybill } = req.body;
    const update = { status };
    if (waybill) update.waybill = waybill;
    if (status === 'Delivered') update.deliveredAt = new Date();
    await Order.findByIdAndUpdate(req.params.id, update);
    req.flash('success', `✅ Status updated to "${status}"`);
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) { req.flash('error', err.message); res.redirect(`/admin/orders/${req.params.id}`); }
});

// DELETE
router.post('/orders/:id/delete', adminAuth, async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  req.flash('success', 'Order deleted.');
  res.redirect('/admin/orders');
});

// MESSAGES
router.get('/messages', adminAuth, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    await Contact.updateMany({ read: false }, { read: true });
    res.render('pages/admin-messages', { title: 'Messages — Admin', page: 'admin', admin: req.session.adminName, messages });
  } catch (err) {
    res.render('pages/admin-messages', { title: 'Messages', page: 'admin', admin: req.session.adminName, messages: [] });
  }
});

// WhatsApp via CallMeBot (free)
async function sendWhatsApp(phone, message) {
  try {
    const cleanPhone = '91' + phone.replace(/\D/g, '').slice(-10);
    const apiKey = process.env.CALLMEBOT_API_KEY;
    if (!apiKey) { console.log(`\n📱 WhatsApp [NO API KEY] to +${cleanPhone}:\n${message}\n`); return; }
    await axios.get('https://api.callmebot.com/whatsapp.php', { params: { phone: cleanPhone, text: message, apikey: apiKey }, timeout: 8000 });
    console.log(`✅ WhatsApp sent to +${cleanPhone}`);
  } catch (err) { console.error('WhatsApp error:', err.message); }
}

// ── RATE CALCULATOR API ──────────────────────
router.get("/orders/:id/rate", adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.json({ success: false, error: "Order not found" });

    // Get Delhivery base cost
    const baseRate = await delhivery.calculateRate(order);

    // Apply pricing engine (global settings + optional overrides)
    const overrides = {
      fixedMargin: req.query.fixedMargin,
      pctMargin  : req.query.pctMargin
    };
    const pricing = await calculateFinalPrice(baseRate.delhiveryCost, overrides);

    res.json({
      success        : true,
      billableWeight : baseRate.billableWeight,
      delhiveryCost  : pricing.delhiveryCost,
      fixedMargin    : pricing.fixedMargin,
      pctMargin      : pricing.pctMargin,
      pctAmount      : pricing.pctAmount,
      totalMargin    : pricing.totalMargin,
      suggestedPrice : pricing.finalPrice,
      codCharge      : baseRate.codCharge || 0,
      isFallback     : baseRate.isFallback || false
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;

// ── EDIT ORDER ADDRESS (before approve) ───────
router.post('/orders/:id/edit-address', adminAuth, async (req, res) => {
  try {
    const {
      senderName, senderPhone, senderAddress, senderCity, senderPin,
      receiverName, receiverPhone, receiverAddress, receiverCity, receiverState, receiverPin
    } = req.body;

    await Order.findByIdAndUpdate(req.params.id, {
      senderName, senderPhone, senderAddress, senderCity, senderPin,
      receiverName, receiverPhone, receiverAddress, receiverCity, receiverState, receiverPin
    });

    req.flash('success', '✅ Address update ho gaya! Ab approve karo.');
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/admin/orders/${req.params.id}`);
  }
});