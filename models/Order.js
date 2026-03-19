const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Reference
  reference:      { type: String, unique: true },
  waybill:        { type: String, default: null },

  // Sender
  senderName:     { type: String, required: true },
  senderPhone:    { type: String, required: true },
  senderAddress:  { type: String, required: true },
  senderPin:      { type: String, required: true },
  senderCity:     { type: String, default: 'Malda' },

  // Receiver
  receiverName:   { type: String, required: true },
  receiverPhone:  { type: String, required: true },
  receiverAddress:{ type: String, required: true },
  receiverPin:    { type: String, required: true },
  receiverCity:   { type: String, required: true },
  receiverState:  { type: String, required: true },

  // Parcel
  weight:         { type: Number, required: true },
  length:         { type: Number, default: 10 },
  breadth:        { type: Number, default: 10 },
  height:         { type: Number, default: 10 },
  declaredValue:  { type: Number, default: 0 },
  paymentMode:    { type: String, enum: ['Prepaid', 'COD'], default: 'Prepaid' },
  codAmount:      { type: Number, default: 0 },
  productDesc:    { type: String, default: 'General' },

  // ── APPROVAL WORKFLOW ─────────────────────────
  approvalStatus: {
    type   : String,
    enum   : ['Awaiting Approval', 'Approved', 'Rejected'],
    default: 'Awaiting Approval'
  },
  // Admin sets final price after negotiation with customer
  finalPrice:     { type: Number, default: null },
  adminNote:      { type: String, default: '' },
  approvedAt:     { type: Date,   default: null },
  rejectedAt:     { type: Date,   default: null },
  rejectionReason:{ type: String, default: '' },

  // WhatsApp/SMS notification sent?
  notifiedCustomer: { type: Boolean, default: false },

  // Status (Delhivery)
  status: {
    type: String,
    enum: ['Awaiting Approval', 'Approved', 'Pending', 'Booked', 'Pickup Scheduled',
           'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled', 'Rejected'],
    default: 'Awaiting Approval'
  },

  // Timestamps
  deliveredAt: { type: Date, default: null },

}, { timestamps: true });

// Auto-generate reference before save
orderSchema.pre('save', function (next) {
  if (!this.reference) {
    this.reference = 'SML' + Date.now().toString().slice(-10);
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);