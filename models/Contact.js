const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name    : { type: String, required: true },
  phone   : { type: String, required: true },
  email   : { type: String, default: '' },
  type    : { type: String, default: 'General' },
  message : { type: String, required: true },
  read    : { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);