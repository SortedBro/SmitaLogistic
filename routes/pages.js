const express   = require('express');
const router    = express.Router();
const axios     = require('axios');
const Order     = require('../models/Order');
const Contact   = require('../models/Contact');
const delhivery = require('../config/delhivery');

// ── WhatsApp to ADMIN (jab new order aaye) ────
async function notifyAdmin(order) {
  try {
    const apiKey     = process.env.CALLMEBOT_API_KEY;
    const adminPhone = '91' + (process.env.ADMIN_PHONE || '8167045246').replace(/\D/g, '');

    const msg = `🔔 *SmitaLogistic — Naya Order!*\n\n`
              + `📦 *Ref:* ${order.reference}\n`
              + `👤 *Sender:* ${order.senderName}\n`
              + `📞 *Phone:* ${order.senderPhone}\n`
              + `📍 *Route:* ${order.senderCity} → ${order.receiverCity}, ${order.receiverState}\n`
              + `⚖️ *Weight:* ${order.weight} kg\n`
              + `💳 *Payment:* ${order.paymentMode}\n`
              + `📝 *Item:* ${order.productDesc}\n\n`
              + `👉 Approve/Reject:\nhttp://localhost:3000/admin/orders\n\n`
              + `_Call karo: ${order.senderPhone}_`;

    if (!apiKey) {
      // No key yet — print to terminal so you still see it
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📱 NEW ORDER — Admin WhatsApp (No API Key Set):`);
      console.log(msg);
      console.log('='.repeat(50) + '\n');
      return;
    }

    await axios.get('https://api.callmebot.com/whatsapp.php', {
      params : { phone: adminPhone, text: msg, apikey: apiKey },
      timeout: 8000
    });
    console.log(`✅ Admin WhatsApp sent — New order: ${order.reference}`);
  } catch (err) {
    console.error('Admin WhatsApp notify error:', err.message);
  }
}

// ── HOME ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const totalOrders     = await Order.countDocuments();
    const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
    res.render('pages/home', {
      title  : 'SmitaLogistic — Parcel Delivery Across India',
      page   : 'home',
      stats  : { totalOrders, deliveredOrders },
      success: req.flash('success'),
      error  : req.flash('error')
    });
  } catch (err) {
    res.render('pages/home', { title: 'SmitaLogistic', page: 'home', stats: {}, success: [], error: [] });
  }
});

// ── BOOK — GET ────────────────────────────────
router.get('/book', (req, res) => {
  res.render('pages/book', {
    title           : 'Book a Shipment — SmitaLogistic',
    page            : 'book',
    success         : req.flash('success'),
    error           : req.flash('error'),
    order           : null,
    awaitingApproval: false
  });
});

// ── BOOK — POST ───────────────────────────────
router.post('/book', async (req, res) => {
  try {
    const {
      senderName, senderPhone, senderAddress, senderPin, senderCity,
      receiverName, receiverPhone, receiverAddress, receiverPin,
      receiverCity, receiverState,
      weight, length, breadth, height,
      declaredValue, paymentMode, codAmount, productDesc
    } = req.body;

    // 1. Save in MongoDB — NO Delhivery API call yet
    const order = new Order({
      senderName, senderPhone, senderAddress, senderPin,
      senderCity : senderCity || 'Malda',
      receiverName, receiverPhone, receiverAddress,
      receiverPin, receiverCity, receiverState,
      weight      : parseFloat(weight),
      length      : parseFloat(length)  || 10,
      breadth     : parseFloat(breadth) || 10,
      height      : parseFloat(height)  || 10,
      declaredValue: parseFloat(declaredValue) || 0,
      paymentMode : paymentMode || 'Prepaid',
      codAmount   : parseFloat(codAmount) || 0,
      productDesc : productDesc || 'General',
      status         : 'Awaiting Approval',
      approvalStatus : 'Awaiting Approval'
    });
    await order.save();

    // 2. Send WhatsApp to ADMIN — "Naya order aaya!"
    notifyAdmin(order); // async — don't await, don't block response

    // 3. Show customer "pending approval" screen
    res.render('pages/book', {
      title           : 'Order Received — SmitaLogistic',
      page            : 'book',
      success         : [],
      error           : [],
      order,
      awaitingApproval: true
    });

  } catch (err) {
    res.render('pages/book', {
      title: 'Book a Shipment — SmitaLogistic', page: 'book',
      success: [], error: [err.message], order: null, awaitingApproval: false
    });
  }
});

// ── TRACK — GET ───────────────────────────────
router.get('/track', (req, res) => {
  const q = req.query.q || '';
  res.render('pages/track', {
    title   : 'Track Your Parcel — SmitaLogistic',
    page    : 'track',
    tracking: null,
    query   : q,
    error   : req.flash('error')
  });
});

// ── TRACK — POST ──────────────────────────────
router.post('/track', async (req, res) => {
  const { trackId } = req.body;
  let tracking = null;
  let error    = null;

  try {
    const order = await Order.findOne({
      $or: [{ reference: trackId }, { waybill: trackId }]
    });

    if (order && order.waybill) {
      try {
        tracking = await delhivery.trackShipment(order.waybill);
        if (tracking.status) {
          order.status = mapStatus(tracking.status);
          await order.save();
        }
      } catch {
        tracking = {
          waybill    : order.waybill,
          status     : order.status,
          origin     : `${order.senderCity}, WB`,
          destination: `${order.receiverCity}, ${order.receiverState}`,
          timeline   : [{ status: order.status, instruction: 'Local status', location: '', time: order.updatedAt, type: 'info' }]
        };
      }
    } else if (order) {
      tracking = {
        waybill    : order.reference,
        status     : order.status,
        origin     : `${order.senderCity || 'Malda'}, WB`,
        destination: `${order.receiverCity}, ${order.receiverState}`,
        timeline   : [{
          status     : order.approvalStatus === 'Awaiting Approval'
                         ? '⏳ Order received — admin approval pending'
                         : order.status,
          instruction: order.approvalStatus === 'Awaiting Approval'
                         ? 'Hum aapko call karenge aur price confirm karenge.'
                         : '',
          location   : 'SmitaLogistic, Malda',
          time       : order.createdAt,
          type       : 'info'
        }]
      };
    } else {
      tracking = await delhivery.trackShipment(trackId);
    }
  } catch (e) {
    error = `"${trackId}" ke liye koi parcel nahi mila. Tracking ID ya Reference check karo.`;
  }

  res.render('pages/track', {
    title: 'Track Parcel — SmitaLogistic', page: 'track',
    tracking, query: trackId, error: error ? [error] : []
  });
});

// ── CONTACT — GET ─────────────────────────────
router.get('/contact', (req, res) => {
  res.render('pages/contact', {
    title  : 'Contact Us — SmitaLogistic',
    page   : 'contact',
    success: req.flash('success'),
    error  : req.flash('error')
  });
});

// ── CONTACT — POST ────────────────────────────
router.post('/contact', async (req, res) => {
  try {
    const { name, phone, email, type, message } = req.body;
    await Contact.create({ name, phone, email, type, message });
    req.flash('success', '✅ Message bhej diya! Hum 2 ghante mein reply karenge.');
    res.redirect('/contact');
  } catch (err) {
    req.flash('error', 'Message send nahi hua. Dobara try karo.');
    res.redirect('/contact');
  }
});

// ── PINCODE CHECK API ─────────────────────────
router.get('/api/pincode', async (req, res) => {
  const { pin } = req.query;
  if (!pin || !/^\d{6}$/.test(pin)) return res.json({ deliverable: false, error: 'Invalid pin' });
  try {
    const result = await delhivery.checkPincode(pin);
    res.json(result);
  } catch (e) {
    res.json({ deliverable: false, error: e.message });
  }
});

function mapStatus(s) {
  if (!s) return 'In Transit';
  const l = s.toLowerCase();
  if (l.includes('delivered'))        return 'Delivered';
  if (l.includes('out for delivery')) return 'Out for Delivery';
  if (l.includes('transit'))          return 'In Transit';
  if (l.includes('pickup'))           return 'Pickup Scheduled';
  return 'In Transit';
}

module.exports = router;