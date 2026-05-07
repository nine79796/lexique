'use strict';

// ════════════════════════════════════════════════════════════════
//  ONBOARDING — Calibrage niveau vocabulaire
//  Présente les mots fréquents un par un, l'user indique s'il
//  connaît chaque mot. Résultat stocké dans state.knownWords.
//
//  3 réponses possibles :
//    'known'  — je connais → markAnkiDone automatique
//    'seen'   — vu mais flou → score de priorité réduit
//    'unknown'— inconnu → laisse le moteur de priorité décider
//
//  L'onboarding peut être repris plus tard (progression sauvegardée).
// ════════════════════════════════════════════════════════════════

const LS_ONBOARDING = 'lexique_onboarding';

const Onboarding = {

  // ── État de session ────────────────────────────────────────

  _words:    [],   // liste des mots à présenter
  _idx:      0,    // index courant
  _results:  {},   // key → 'known' | 'seen' | 'unknown'

  // ── Persistence ────────────────────────────────────────────

  load() {
    try {
      return JSON.parse(localStorage.getItem(LS_ONBOARDING) || '{}');
    } catch { return {}; }
  },

  save(data) {
    try { localStorage.setItem(LS_ONBOARDING, JSON.stringify(data)); } catch { }
  },

  isComplete() {
    const d = this.load();
    return d.complete === true;
  },

  getProgress() {
    const d = this.load();
    return { done: d.done || 0, total: d.total || 500 };
  },

  // ── Initialisation ─────────────────────────────────────────

  buildWordList() {
    if (typeof FREQ_EN === 'undefined') return [];

    // Trier par rang, ignorer top 200 (trop basique), prendre jusqu'à rang 3000
    const sorted = Object.entries(FREQ_EN)
      .filter(([, rank]) => rank > 200 && rank <= 3000)
      .sort((a, b) => a[1] - b[1])
      .map(([word]) => word);

    return sorted.slice(0, 500);
  },

  // ── Lancement ─────────────────────────────────────────────

  start() {
    const d = this.load();

    this._words   = this.buildWordList();
    this._idx     = d.lastIdx || 0;
    this._results = d.results || {};

    if (!this._words.length) {
      console.warn('[Onboarding] FREQ_EN non disponible');
      return;
    }

    this._render();
  },

  // ── Réponse ────────────────────────────────────────────────

  answer(choice) {
    const word = this._words[this._idx];
    if (!word) return;

    this._results[word] = choice;

    // Si "known" → marquer ankiDone dans state
    if (choice === 'known') {
      const key = word.toLowerCase().replace(/\s+/g, '_');
      if (!state.words[key]) {
        // Créer le mot avec ankiDone = true sans occurrence
        state.words[key] = {
          label:       word,
          createdAt:   Date.now(),
          updatedAt:   Date.now(),
          catKey:      null,
          source:      null,
          occurrences: [],
          ankiDone:    true,
          ankiDoneAt:  Date.now(),
          validity:    'unknown',
          fromOnboarding: true,
        };
      } else {
        state.words[key].ankiDone   = true;
        state.words[key].ankiDoneAt = Date.now();
        state.words[key].updatedAt  = Date.now();
      }
    }

    // Si "seen" → stocker dans knownWords avec flag 'seen'
    if (choice === 'seen') {
      state.knownWords ??= {};
      const key = word.toLowerCase().replace(/\s+/g, '_');
      state.knownWords[key] = 'seen';
    }

    this._idx++;
    this._saveProgress();

    // Stop automatique si :
    // - 10 "unknown" consécutifs après rank 1500 → l'user est à son plafond
    // - tous les mots parcourus
    if (this._idx >= this._words.length || this._shouldStop()) {
      this._finish();
      return;
    }

    this._render();
  },

  _shouldStop() {
    // Si les 15 derniers mots sont tous "unknown" → on arrête
    if (this._idx < 15) return false;
    const last15 = this._words
      .slice(this._idx - 15, this._idx)
      .every(w => this._results[w] === 'unknown');
    return last15;
  },

  skip() {
    this._saveProgress();
    this._close();
  },

  _saveProgress() {
    this.save({
      done:    this._idx,
      total:   this._words.length,
      lastIdx: this._idx,
      results: this._results,
      complete: false,
    });
    // Sauvegarder state (pour les ankiDone ajoutés)
    if (typeof save === 'function') save();
  },

  _finish() {
    this.save({
      done:     this._idx,
      total:    this._words.length,
      lastIdx:  this._idx,
      results:  this._results,
      complete: true,
    });
    if (typeof save === 'function') save();
    this._renderFinished();
  },

  // ── UI ─────────────────────────────────────────────────────

  _render() {
    const word  = this._words[this._idx];
    const total = this._words.length;
    const done  = this._idx;
    const pct   = Math.round(done / total * 100);
    const rank  = (typeof FREQ_EN !== 'undefined' && FREQ_EN[word]) ? FREQ_EN[word] : '?';

    const overlay = document.getElementById('onboardingOverlay');
    if (!overlay) return;

    overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-header">
          <span class="onboarding-title">Calibrage vocabulaire</span>
          <button class="onboarding-skip-btn" onclick="Onboarding.skip()">Plus tard →</button>
        </div>
        <div class="onboarding-progress-wrap">
          <div class="onboarding-progress-bar" style="width:${pct}%"></div>
        </div>
        <div class="onboarding-counter">${done} / ${total}</div>

        <div class="onboarding-word">${escHtml(word)}</div>
        <div class="onboarding-rank">Top ${rank} mots anglais</div>

        <div class="onboarding-choices">
          <button class="onboarding-btn btn-known"  onclick="Onboarding.answer('known')">
            <span class="ob-icon">✅</span>
            <span class="ob-label">Je connais</span>
          </button>
          <button class="onboarding-btn btn-seen"   onclick="Onboarding.answer('seen')">
            <span class="ob-icon">👀</span>
            <span class="ob-label">Vu mais flou</span>
          </button>
          <button class="onboarding-btn btn-unknown" onclick="Onboarding.answer('unknown')">
            <span class="ob-icon">❌</span>
            <span class="ob-label">Inconnu</span>
          </button>
        </div>

        <div class="onboarding-hint">
          Tu peux t'arrêter à tout moment — ta progression est sauvegardée.
        </div>
      </div>`;

    overlay.classList.add('open');
  },

  _renderFinished() {
    const known   = Object.values(this._results).filter(v => v === 'known').length;
    const seen    = Object.values(this._results).filter(v => v === 'seen').length;
    const unknown = Object.values(this._results).filter(v => v === 'unknown').length;

    const overlay = document.getElementById('onboardingOverlay');
    if (!overlay) return;

    overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-header">
          <span class="onboarding-title">Calibrage terminé !</span>
        </div>
        <div class="onboarding-finished-icon">🎯</div>
        <div class="onboarding-finished-stats">
          <div class="ob-stat"><span class="ob-stat-val known">${known}</span><span class="ob-stat-label">Connus</span></div>
          <div class="ob-stat"><span class="ob-stat-val seen">${seen}</span><span class="ob-stat-label">Vus</span></div>
          <div class="ob-stat"><span class="ob-stat-val unknown">${unknown}</span><span class="ob-stat-label">Inconnus</span></div>
        </div>
        <div class="onboarding-finished-msg">
          Le système de priorité Anki est maintenant calibré pour toi.
        </div>
        <button class="btn" onclick="Onboarding._close()" style="margin-top:20px">C'est parti !</button>
      </div>`;
  },

  _close() {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) overlay.classList.remove('open');
  },

  // ── Bannière de rappel si pas encore fait ─────────────────

  checkBanner() {
    const banner = document.getElementById('onboardingBanner');
    if (!banner) return;
    if (this.isComplete()) { banner.classList.remove('show'); return; }
    const { done } = this.getProgress();
    // Afficher si onboarding pas commencé ou en cours
    banner.querySelector('.onboarding-banner-text').textContent =
      done > 0
        ? `Calibrage en cours — ${done}/500 mots (reprendre)`
        : 'Calibre ton niveau pour des suggestions Anki précises';
    banner.classList.add('show');
  },
};

// Keyboard shortcut : Escape ferme l'onboarding
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') Onboarding._close();
});
