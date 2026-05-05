'use strict';

// ════════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════════

const ANKI_THRESHOLD = 3;
// MAX_CLICKS supprimé — le comptage est illimité après ankiDone.
// C'est Anki qui gère la répétition espacée, pas cette app.

/** Sources d'exposition par défaut — l'utilisateur peut en créer d'autres */
const DEFAULT_SOURCES = [
  { key: 'lecture',      emoji: '📖', labelKey: 'sources.lecture' },
  { key: 'video',        emoji: '🎬', labelKey: 'sources.video'   },
  { key: 'audio',        emoji: '🎧', labelKey: 'sources.audio'   },
  { key: 'conversation', emoji: '💬', labelKey: 'sources.conversation' },
];
// La clé est injectée par /config.js (généré par Vercel au build, jamais commité).
// En local : créer un fichier config.js à la racine contenant :
//   const __WORDNIK_KEY__ = 'ta_clé_ici';
const WORDNIK_API_KEY = (typeof __WORDNIK_KEY__ !== 'undefined' && __WORDNIK_KEY__)
  ? __WORDNIK_KEY__
  : '';

/** Colour palette for user-defined word categories */
const PALETTE = [
  { bg: 'rgba(200,169,110,0.14)', color: '#c8a96e', border: 'rgba(200,169,110,0.25)' },
  { bg: 'rgba(110,180,200,0.14)', color: '#6eb4c8', border: 'rgba(110,180,200,0.25)' },
  { bg: 'rgba(140,200,110,0.14)', color: '#8cc86e', border: 'rgba(140,200,110,0.25)' },
  { bg: 'rgba(180,110,200,0.14)', color: '#b46ec8', border: 'rgba(180,110,200,0.25)' },
  { bg: 'rgba(200,110,130,0.14)', color: '#c86e82', border: 'rgba(200,110,130,0.25)' },
  { bg: 'rgba(100,160,220,0.14)', color: '#64a0dc', border: 'rgba(100,160,220,0.25)' },
];

/** Fixed colours for built-in task categories */
const TASK_CAT_COLORS = {
  perso: { bg: 'rgba(110,180,200,0.14)', color: '#6eb4c8', border: 'rgba(110,180,200,0.25)' },
  pro:   { bg: 'rgba(200,169,110,0.14)', color: '#c8a96e', border: 'rgba(200,169,110,0.25)' },
  etude: { bg: 'rgba(140,200,110,0.14)', color: '#8cc86e', border: 'rgba(140,200,110,0.25)' },
  sport: { bg: 'rgba(200,110,130,0.14)', color: '#c86e82', border: 'rgba(200,110,130,0.25)' },
  autre: { bg: 'rgba(180,110,200,0.14)', color: '#b46ec8', border: 'rgba(180,110,200,0.25)' },
};

/** i18n keys for task category labels */
const TASK_CAT_LABELS_KEY = {
  perso: 'cats.perso', pro: 'cats.pro', etude: 'cats.etude',
  sport: 'cats.sport', autre: 'cats.autre', '': '',
};

/** localStorage keys */
const LS_KEY_STATE = 'lexique_v6';
const LS_KEY_THEME = 'lexique_theme';
const LS_KEY_LANG  = 'lexique_lang';
const LS_KEY_SUGG  = 'lexique_sugg_prefs';
const LS_KEY_HIST  = 'lexique_sugg_hist';
/** Keys that trigger a cloud sync when written */
const LS_SYNC_KEYS = [LS_KEY_STATE, LS_KEY_THEME, 'lexique_timer', 'lexique_spelling_srs'];
