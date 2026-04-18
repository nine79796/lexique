'use strict';

// ════════════════════════════════════════════════════════════════
//  UTILITIES — Date helpers & DOM utilities
// ════════════════════════════════════════════════════════════════

const DateUtils = {
  ts() { return Date.now(); },
  todayStr() { return this.fmtDay(Date.now()); },

  /** Format timestamp as YYYY-MM-DD */
  fmtDay(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  },

  /** Format timestamp as DD/MM/YYYY */
  fmtShort(ts) {
    const d = new Date(ts);
    return String(d.getDate()).padStart(2, '0') + '/'
      + String(d.getMonth() + 1).padStart(2, '0') + '/'
      + d.getFullYear();
  },

  /** Format timestamp as DD/MM/YYYY HH:MM */
  fmtFull(ts) {
    return this.fmtShort(ts) + ' '
      + String(new Date(ts).getHours()).padStart(2, '0') + ':'
      + String(new Date(ts).getMinutes()).padStart(2, '0');
  },

  /** Add N days to a YYYY-MM-DD string, return YYYY-MM-DD */
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return this.fmtDay(d.getTime());
  },

  daysBetween(a, b) {
    return Math.round(
      (new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86_400_000
    );
  },

  getDow(dateStr) {
    return new Date(dateStr + 'T12:00:00').getDay();
  },

  getLocale() {
    return currentLang === 'en' ? 'en-GB'
      : currentLang === 'es'   ? 'es-ES'
      : 'fr-FR';
  },
};

// Convenience aliases kept for call-site compatibility
const ts            = ()         => DateUtils.ts();
const todayStr      = ()         => DateUtils.todayStr();
const fmtDay        = ts         => DateUtils.fmtDay(ts);
const fmtShort      = ts         => DateUtils.fmtShort(ts);
const fmtFull       = ts         => DateUtils.fmtFull(ts);
const addDays       = (d, n)     => DateUtils.addDays(d, n);
const daysBetween   = (a, b)     => DateUtils.daysBetween(a, b);
const getDowFromStr = d          => DateUtils.getDow(d);

/** Safe HTML escaping — prevents XSS in user-supplied strings. */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/** Slugify a label into a URL/key-safe string */
function slug(s) {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
