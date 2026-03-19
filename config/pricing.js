// ════════════════════════════════════════════
//  SmitaLogistic — Pricing Engine
//  Final Price = Delhivery Cost + Fixed + (Cost × Pct%)
// ════════════════════════════════════════════
const Settings = require('../models/Settings');

/**
 * Calculate final customer price
 * @param {number} delhiveryCost  — actual Delhivery charge
 * @param {object} overrides      — per-order overrides (optional)
 * @returns {object}
 */
async function calculateFinalPrice(delhiveryCost, overrides = {}) {
  // Load global settings from DB
  const s = await Settings.getAll();

  const fixedMargin = overrides.fixedMargin  !== undefined
    ? parseFloat(overrides.fixedMargin)
    : parseFloat(s.fixedMargin  ?? process.env.FIXED_MARGIN  ?? 50);

  const pctMargin = overrides.pctMargin !== undefined
    ? parseFloat(overrides.pctMargin)
    : parseFloat(s.pctMargin ?? process.env.PCT_MARGIN ?? 0);

  const pctAmount   = Math.ceil(delhiveryCost * pctMargin / 100);
  const totalMargin = fixedMargin + pctAmount;
  const finalPrice  = Math.ceil(delhiveryCost + totalMargin);

  return {
    delhiveryCost,
    fixedMargin,
    pctMargin,
    pctAmount,
    totalMargin,
    finalPrice
  };
}

module.exports = { calculateFinalPrice };