/** Shared chip constants (safe for backend without frontend deps). */

const TRANSFER_CHIP_IDS = ['WC', 'FH'];

function transferChipsAvailableForGameweek(gameweek) {
  return (gameweek || 1) > 1;
}

function isTransferChip(chipId) {
  return TRANSFER_CHIP_IDS.includes(chipId);
}

module.exports = {
  TRANSFER_CHIP_IDS,
  transferChipsAvailableForGameweek,
  isTransferChip,
};
