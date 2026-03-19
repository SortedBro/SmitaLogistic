const axios = require('axios');

const BASE  = () => process.env.DELHIVERY_BASE_URL;
const TOKEN = () => process.env.DELHIVERY_TOKEN;
const headers = () => ({ Authorization: `Token ${TOKEN()}`, 'Content-Type': 'application/json' });
const formHeaders = () => ({ Authorization: `Token ${TOKEN()}`, 'Content-Type': 'application/x-www-form-urlencoded' });

// ── Check pincode serviceability ──────────────
async function checkPincode(pin) {
  const r = await axios.get(`${BASE()}/c/api/pin-codes/json/`, {
    params: { filter_codes: pin }, headers: headers()
  });
  const p = r.data?.delivery_codes?.[0]?.postal_code;
  if (!p) return { deliverable: false };
  return {
    deliverable: true,
    city: p.city, state: p.state_code,
    cod: p.cod === 'Y', prepaid: p.pre_paid === 'Y', pickup: p.pickup === 'Y'
  };
}

// ── Create shipment + schedule pickup ─────────
async function createShipment(order) {
  const payload = {
    shipments: [{
      name: order.receiverName, add: order.receiverAddress,
      pin: order.receiverPin, city: order.receiverCity, state: order.receiverState,
      country: 'India', phone: order.receiverPhone,
      order: order.reference,
      payment_mode: order.paymentMode === 'COD' ? 'COD' : 'Prepaid',
      return_pin: order.senderPin, return_city: order.senderCity || 'Malda',
      return_phone: order.senderPhone, return_add: order.senderAddress,
      return_name: order.senderName, return_state: 'West Bengal', return_country: 'India',
      products_desc: order.productDesc || 'General',
      cod_amount: order.paymentMode === 'COD' ? (order.codAmount || 0) : 0,
      order_date: new Date().toISOString(),
      total_amount: order.declaredValue || 0,
      seller_add: order.senderAddress, seller_name: 'SmitaLogistic',
      seller_inv: order.reference,
      quantity: 1,
      weight: order.weight,
      length: order.length || 10, breadth: order.breadth || 10, height: order.height || 10,
      weight_unit: 'kg',
      volumetric_weight: ((order.length||10)*(order.breadth||10)*(order.height||10))/5000,
      num_pieces: 1, fragile_shipment: false,
      pickup_location: process.env.DELHIVERY_PICKUP_LOCATION
    }],
    pickup_location: { name: process.env.DELHIVERY_PICKUP_LOCATION }
  };

  const r = await axios.post(
    `${BASE()}/api/cmu/create.json`,
    `format=json&data=${encodeURIComponent(JSON.stringify(payload))}`,
    { headers: formHeaders() }
  );

  const waybill = r.data?.packages?.[0]?.waybill;
  if (!waybill) throw new Error('AWB not returned: ' + JSON.stringify(r.data));

  // Schedule pickup
  const pickupTime = nextPickupTime();
  await axios.post(
    `${BASE()}/fm/request/new/`,
    `format=json&data=${encodeURIComponent(JSON.stringify({
      pickup_time: pickupTime,
      pickup_location: process.env.DELHIVERY_PICKUP_LOCATION,
      expected_package_count: 1
    }))}`,
    { headers: formHeaders() }
  );

  return { waybill, pickupTime };
}

// ── Track shipment ────────────────────────────
async function trackShipment(waybill) {
  const r = await axios.get(`${BASE()}/api/v1/packages/json/`, {
    params: { waybill }, headers: headers()
  });
  const ship = r.data?.ShipmentData?.[0]?.Shipment;
  if (!ship) throw new Error('No tracking data found.');
  return {
    waybill,
    status      : ship?.Status?.Status,
    origin      : ship?.Origin,
    destination : ship?.Destination,
    expectedDate: ship?.ExpectedDeliveryDate,
    receiverName: ship?.ReceiverName,
    senderName  : ship?.SenderName,
    timeline    : (ship?.Scans || []).map(s => ({
      status      : s.ScanDetail?.Scan || '',
      instruction : s.ScanDetail?.Instructions || '',
      location    : s.ScanDetail?.ScannedLocation || '',
      time        : s.ScanDetail?.ScanDateTime || '',
      type        : mapScan(s.ScanDetail?.Scan)
    }))
  };
}

function mapScan(scan) {
  if (!scan) return 'info';
  const s = scan.toLowerCase();
  if (s.includes('pickup') || s.includes('manifest')) return 'pickup';
  if (s.includes('transit'))                           return 'transit';
  if (s.includes('out for delivery') || s.includes('ofd')) return 'ofd';
  if (s.includes('delivered'))                         return 'delivered';
  if (s.includes('rto') || s.includes('return'))       return 'return';
  if (s.includes('undelivered') || s.includes('failed')) return 'failed';
  return 'info';
}

function nextPickupTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

module.exports = { checkPincode, createShipment, trackShipment, calculateRate };

// ── Calculate Shipping Rate ───────────────────
async function calculateRate(order) {
  try {
    const billableWeight = Math.max(
      parseFloat(order.weight) || 0,
      (((order.length||10) * (order.breadth||10) * (order.height||10)) / 5000)
    );
    const r = await axios.get(`${BASE()}/api/kinko/v2/estimate/`, {
      params: {
        md        : 'S',
        cgm       : Math.ceil(billableWeight * 1000),
        o_pin     : order.senderPin,
        d_pin     : order.receiverPin,
        ss        : 'Delivered',
        cod       : order.paymentMode === 'COD' ? 1 : 0,
        cod_amount: order.paymentMode === 'COD' ? (order.codAmount||0) : 0,
      },
      headers: headers()
    });
    const data           = r.data;
    const delhiveryCost  = parseFloat(data?.total_amount || data?.charged_amount || 0);
    const margin         = parseFloat(process.env.SHIPPING_MARGIN || 50);
    const suggestedPrice = Math.ceil(delhiveryCost + margin);
    return { success: true, delhiveryCost, margin, suggestedPrice, billableWeight: billableWeight.toFixed(2), isFallback: false };
  } catch (err) {
    return fallbackRate(order);
  }
}

function fallbackRate(order) {
  const w = Math.max(
    parseFloat(order.weight) || 0,
    (((order.length||10) * (order.breadth||10) * (order.height||10)) / 5000)
  );
  const margin = parseFloat(process.env.SHIPPING_MARGIN || 50);
  let base = 0;
  if      (w <= 0.5) base = 55;
  else if (w <= 1)   base = 70;
  else if (w <= 2)   base = 95;
  else if (w <= 3)   base = 120;
  else if (w <= 5)   base = 160;
  else if (w <= 10)  base = 220;
  else if (w <= 20)  base = 350;
  else               base = Math.ceil(w * 18);
  const codCharge     = order.paymentMode === 'COD' ? Math.ceil((order.codAmount||0) * 0.018 + 30) : 0;
  const delhiveryCost = base + codCharge;
  const suggestedPrice = Math.ceil(delhiveryCost + margin);
  return { success: true, delhiveryCost, margin, suggestedPrice, billableWeight: w.toFixed(2), codCharge, isFallback: true };
}