'use strict';

// ════════════════════════════════════════════════════════════════
//  UTILITIES — Date helpers & DOM utilities
// ════════════════════════════════════════════════════════════════

const DateUtils = {
  ts() { return Date.now(); },
  todayStr() { return this.fmtDay(Date.now()); },

  /** Format timestamp as YYYY-MM-DD */
  fmtDay(timestamp) {
    const d = new Date(timestamp);
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  },

  /** Format timestamp as DD/MM/YYYY */
  fmtShort(timestamp) {
    const d = new Date(timestamp);
    return String(d.getDate()).padStart(2, '0') + '/'
      + String(d.getMonth() + 1).padStart(2, '0') + '/'
      + d.getFullYear();
  },

  /** Format timestamp as DD/MM/YYYY HH:MM */
  fmtFull(timestamp) {
    return this.fmtShort(timestamp) + ' '
      + String(new Date(timestamp).getHours()).padStart(2, '0') + ':'
      + String(new Date(timestamp).getMinutes()).padStart(2, '0');
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

// FIX: Convenience aliases — renamed the parameter in fmtDay/fmtShort/fmtFull
// aliases from `ts` to `stamp` to avoid shadowing the ts() function in the
// enclosing scope, which caused confusing behaviour when aliases were called
// in contexts where `ts` was also in scope.
const ts            = ()            => DateUtils.ts();
const todayStr      = ()            => DateUtils.todayStr();
const fmtDay        = stamp         => DateUtils.fmtDay(stamp);
const fmtShort      = stamp         => DateUtils.fmtShort(stamp);
const fmtFull       = stamp         => DateUtils.fmtFull(stamp);
const addDays       = (d, n)        => DateUtils.addDays(d, n);
const daysBetween   = (a, b)        => DateUtils.daysBetween(a, b);
const getDowFromStr = d             => DateUtils.getDow(d);

/** Safe HTML escaping — prevents XSS in user-supplied strings. */
function escHtml(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

/** Slugify a label into a URL/key-safe string */
function slug(s) {
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
