'use strict';

// ════════════════════════════════════════════════════════════════
//  WORD LOOKUP — Popup définition / prononciation / exemples
//  Sources :
//    • Anglais  → Wordnik API (clé requise)
//    • FR/ES/DE → Free Dictionary API (api.dictionaryapi.dev)
// ════════════════════════════════════════════════════════════════

const WordLookup = {
  // Cache mémoire : "mot|lang" → data | null
  _cache: {},

  // Popup DOM actif
  _popup: null,

  // ── API helpers ────────────────────────────────────────────

  async fetchWordnik(word) {
    if (!WORDNIK_API_KEY) return null;
    try {
      const [defRes, audioRes, exRes] = await Promise.allSettled([
        fetch(`https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/definitions?limit=3&includeRelated=false&useCanonical=true&includeTags=false&api_key=${WORDNIK_API_KEY}`, { signal: AbortSignal.timeout(5000) }),
        fetch(`https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/pronunciations?limit=1&api_key=${WORDNIK_API_KEY}`, { signal: AbortSignal.timeout(5000) }),
        fetch(`https://api.wordnik.com/v4/word.json/${encodeURIComponent(word)}/examples?limit=2&api_key=${WORDNIK_API_KEY}`, { signal: AbortSignal.timeout(5000) }),
      ]);

      const defs  = defRes.status  === 'fulfilled' && defRes.value.ok  ? await defRes.value.json()  : [];
      const audio = audioRes.status === 'fulfilled' && audioRes.value.ok ? await audioRes.value.json() : [];
      const exs   = exRes.status   === 'fulfilled' && exRes.value.ok   ? await exRes.value.json()   : { examples: [] };

      if (!defs.length) return null;

      return {
        source: 'wordnik',
        definitions: defs.slice(0, 3).map(d => ({
          partOfSpeech: d.partOfSpeech || '',
          text:         (d.text || '').replace(/<[^>]+>/g, ''),
        })),
        pronunciation: audio[0]?.raw || audio[0]?.rawType || '',
        examples: (exs.examples || []).slice(0, 2).map(e => e.text || ''),
      };
    } catch { return null; }
  },

  async fetchFreeDictionary(word, lang) {
    // api.dictionaryapi.dev supporte : en, fr, es, de, it, pt, ru, ar, hi, ja, ko, zh...
    const langMap = { en: 'en', fr: 'fr', es: 'es', de: 'de', it: 'it', pt: 'pt' };
    const apiLang = langMap[lang] || lang;
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/${apiLang}/${encodeURIComponent(word.toLowerCase())}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return null;

      const entry = data[0];
      const defs  = [];
      const exs   = [];

      (entry.meanings || []).forEach(meaning => {
        (meaning.definitions || []).slice(0, 2).forEach(d => {
          defs.push({ partOfSpeech: meaning.partOfSpeech || '', text: d.definition || '' });
          if (d.example) exs.push(d.example);
        });
      });

      // Prononciation : IPA si disponible
      const phonetics = (entry.phonetics || []).filter(p => p.text);
      const pronunc   = phonetics[0]?.text || entry.phonetic || '';

      return {
        source: 'freedict',
        definitions: defs.slice(0, 3),
        pronunciation: pronunc,
        examples: exs.slice(0, 2),
      };
    } catch { return null; }
  },

  async lookup(word, lang) {
    const cacheKey = `${word.toLowerCase()}|${lang}`;
    if (this._cache[cacheKey] !== undefined) return this._cache[cacheKey];

    let result = null;
    if (lang === 'en' && WORDNIK_API_KEY) {
      result = await this.fetchWordnik(word);
    }
    // Fallback ou autres langues → Free Dictionary
    if (!result) {
      result = await this.fetchFreeDictionary(word, lang);
    }

    this._cache[cacheKey] = result;
    return result;
  },

  // ── Popup UI ───────────────────────────────────────────────

  /**
   * Ouvre le popup de définition ancré sur l'élément `anchorEl`.
   * Appelé par le bouton "?" sur chaque carte de mot.
   */
  async open(word, anchorEl) {
    // Fermer un popup déjà ouvert
    this.close();

    // Créer le popup en état de chargement
    const popup = document.createElement('div');
    popup.className = 'wl-popup';
    popup.innerHTML = `<div class="wl-loading"><span class="val-spinner"></span> ${escHtml(word)}</div>`;
    document.body.appendChild(popup);
    this._popup = popup;

    // Positionnement
    this._position(popup, anchorEl);

    // Fermer au clic extérieur
    const onOutside = e => {
      if (!popup.contains(e.target) && e.target !== anchorEl) {
        this.close();
        document.removeEventListener('mousedown', onOutside);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside), 0);

    // Fetch
    const lang   = (typeof currentLang !== 'undefined' ? currentLang : 'en');
    const result = await this.lookup(word, lang);

    if (!this._popup) return; // fermé pendant le fetch

    if (!result) {
      popup.innerHTML = `
        <div class="wl-header">
          <span class="wl-word">${escHtml(word)}</span>
          <button class="wl-close" onclick="WordLookup.close()">×</button>
        </div>
        <div class="wl-empty">${t('lookup.not_found') || 'Aucune définition trouvée.'}</div>`;
      this._position(popup, anchorEl);
      return;
    }

    // Rendu
    const sourceLabel = result.source === 'wordnik' ? 'Wordnik' : 'Dictionary API';
    const pronHtml    = result.pronunciation
      ? `<span class="wl-pronunc">/${escHtml(result.pronunciation)}/</span>` : '';

    const defsHtml = result.definitions.map(d => `
      <div class="wl-def">
        ${d.partOfSpeech ? `<span class="wl-pos">${escHtml(d.partOfSpeech)}</span>` : ''}
        <span class="wl-def-text">${escHtml(d.text)}</span>
      </div>`).join('');

    const exsHtml = result.examples.length
      ? `<div class="wl-section-label">${t('lookup.examples') || 'Exemples'}</div>`
        + result.examples.map(e => `<div class="wl-example">"${escHtml(e)}"</div>`).join('')
      : '';

    popup.innerHTML = `
      <div class="wl-header">
        <span class="wl-word">${escHtml(word)}</span>
        ${pronHtml}
        <button class="wl-close" onclick="WordLookup.close()">×</button>
      </div>
      <div class="wl-body">
        ${defsHtml}
        ${exsHtml}
        <div class="wl-source">${sourceLabel}</div>
      </div>`;

    this._position(popup, anchorEl);
  },

  close() {
    if (this._popup) { this._popup.remove(); this._popup = null; }
  },

  _position(popup, anchor) {
    // Positionner sous l'ancre, en évitant les bords
    const rect    = anchor.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    popup.style.position = 'absolute';
    popup.style.top      = (rect.bottom + scrollY + 6) + 'px';
    popup.style.left     = Math.max(8, rect.left + scrollX) + 'px';

    // Ajuster si déborde à droite
    requestAnimationFrame(() => {
      const pw = popup.offsetWidth;
      const vw = window.innerWidth;
      if (rect.left + pw + 8 > vw) {
        popup.style.left = Math.max(8, vw - pw - 8) + 'px';
      }
      // Ajuster si déborde en bas
      const ph  = popup.offsetHeight;
      const vh  = window.innerHeight;
      const top = rect.bottom + scrollY + 6;
      if (rect.bottom + ph + 6 > vh) {
        popup.style.top = (rect.top + scrollY - ph - 6) + 'px';
      }
    });
  },
};

// Fermer le popup sur Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') WordLookup.close();
});
