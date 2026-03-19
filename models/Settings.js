const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key  : { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

// Static helper — get all settings as object
settingsSchema.statics.getAll = async function () {
  const rows = await this.find();
  const obj  = {};
  rows.forEach(r => obj[r.key] = r.value);
  return obj;
};

// Static helper — set a key
settingsSchema.statics.set = async function (key, value) {
  return this.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
};

module.exports = mongoose.model('Settings', settingsSchema);