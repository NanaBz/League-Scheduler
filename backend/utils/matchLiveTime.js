/**
 * Round a local Date to the nearest 15-minute boundary (:00, :15, :30, :45).
 * Returns { dateMidnightLocal: Date, timeHHMM: string } for storing match.date + match.time.
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

function nearestQuarterLocalParts(now = new Date()) {
  const d = new Date(now);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const elapsed = d.getTime() - dayStart.getTime();
  const q = 15 * 60 * 1000;
  let roundedMs = Math.round(elapsed / q) * q;
  if (roundedMs >= 86400000) {
    roundedMs = 86400000 - q;
  }
  if (roundedMs < 0) {
    roundedMs = 0;
  }
  const out = new Date(dayStart.getTime() + roundedMs);
  const dateMidnightLocal = new Date(out.getFullYear(), out.getMonth(), out.getDate());
  const timeHHMM = `${pad2(out.getHours())}:${pad2(out.getMinutes())}`;
  return { dateMidnightLocal, timeHHMM };
}

module.exports = { nearestQuarterLocalParts };
