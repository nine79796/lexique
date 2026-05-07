'use strict';

// ════════════════════════════════════════════════════════════════
//  PRIORITY ENGINE — Système de priorité intelligent Anki
//  Combine fréquence globale (Subtlex-US) × usage personnel
// ════════════════════════════════════════════════════════════════

const PriorityEngine = {

  // ── Score de priorité d'un mot ────────────────────────────────
  //
  //  Facteurs :
  //  1. freqScore   — rang dans Subtlex-US (1=très fréquent → score élevé)
  //  2. occScore    — nombre de fois que l'user a vu ce mot
  //  3. recencyScore — récence des occurrences (vu cette semaine = boost)
  //  4. waitScore   — temps d'attente sans être mis sur Anki
  //
  //  Un mot est éligible uniquement s'il :
  //  - n'est pas déjà ankiDone
  //  - a au moins 1 occurrence
  //  - n'est pas dans le top 200 (mots ultra-basiques, l'user les sait déjà)

  scoreWord(word) {
    if (word.ankiDone) return 0;
    if (!word.occurrences || word.occurrences.length === 0) return 0;

    const label = word.label.toLowerCase().trim();
    const now   = Date.now();
    const DAY   = 86_400_000;

    // 1. Score fréquence globale (Subtlex-US)
    //    rang 1–200   → skip (trop basique)
    //    rang 201–500 → score max 100
    //    rang 501–3000 → score 60–100
    //    rang 3001–10000 → score 20–60
    //    absent de la liste → score 10 (mot rare mais dans ton contexte)
    let freqScore = 10;
    if (typeof FREQ_EN !== 'undefined' && FREQ_EN[label]) {
      const rank = FREQ_EN[label];
      if (rank <= 200)        return 0; // trop basique, skip
      if (rank <= 500)        freqScore = 100;
      else if (rank <= 1000)  freqScore = 90;
      else if (rank <= 2000)  freqScore = 80;
      else if (rank <= 3000)  freqScore = 70;
      else if (rank <= 5000)  freqScore = 50;
      else if (rank <= 7000)  freqScore = 35;
      else                    freqScore = 20;
    }

    // 2. Score occurrences personnelles
    //    Logarithmique pour éviter qu'un mot cliqué 50x écrase tout
    const occ = word.occurrences.length;
    const occScore = Math.min(100, Math.round(Math.log2(occ + 1) * 30));

    // 3. Score récence — bonus si vu dans les 7 derniers jours
    const lastSeen  = word.occurrences[word.occurrences.length - 1] || 0;
    const daysSince = (now - lastSeen) / DAY;
    let recencyScore = 0;
    if (daysSince <= 1)       recencyScore = 40;
    else if (daysSince <= 3)  recencyScore = 30;
    else if (daysSince <= 7)  recencyScore = 20;
    else if (daysSince <= 14) recencyScore = 10;

    // 4. Score d'attente — plus le mot attend, plus il monte
    const createdAt  = word.createdAt || word.occurrences[0] || now;
    const daysWaiting = (now - createdAt) / DAY;
    let waitScore = 0;
    if (daysWaiting >= 30)     waitScore = 40;
    else if (daysWaiting >= 14) waitScore = 25;
    else if (daysWaiting >= 7)  waitScore = 15;
    else if (daysWaiting >= 3)  waitScore = 5;

    // Score final — pondéré
    // fréquence globale compte le plus (c'est la base de la décision)
    const total = (freqScore * 0.40)
                + (occScore  * 0.25)
                + (recencyScore * 0.20)
                + (waitScore    * 0.15);

    return Math.round(total);
  },

  // ── Raison lisible pour l'UI ──────────────────────────────────

  getReason(word) {
    const label = word.label.toLowerCase().trim();
    const now   = Date.now();
    const DAY   = 86_400_000;

    const rank      = (typeof FREQ_EN !== 'undefined' && FREQ_EN[label]) ? FREQ_EN[label] : null;
    const occ       = word.occurrences.length;
    const lastSeen  = word.occurrences[word.occurrences.length - 1] || 0;
    const daysSince = Math.round((now - lastSeen) / DAY);
    const createdAt = word.createdAt || word.occurrences[0] || now;
    const daysWait  = Math.round((now - createdAt) / DAY);

    // Priorité de la raison : fréquence > récence > attente > occurrences
    if (rank && rank <= 500)  return { icon: '⭐', text: `Top ${rank} mots anglais` };
    if (rank && rank <= 1000) return { icon: '🔥', text: `Top 1000 — mot très courant` };
    if (rank && rank <= 3000) return { icon: '📈', text: `Top 3000 — mot courant` };
    if (daysSince <= 2 && occ >= 3) return { icon: '🔥', text: `Vu ${occ}× récemment` };
    if (daysWait >= 14)       return { icon: '⏳', text: `Attend depuis ${daysWait} jours` };
    if (occ >= 5)             return { icon: '📊', text: `Vu ${occ}× dans ton contexte` };
    if (daysSince <= 3)       return { icon: '⚡', text: `Vu il y a ${daysSince}j` };
    return                           { icon: '📝', text: rank ? `Rang #${rank}` : `Mot rare mais utile` };
  },

  // ── Calcul du quota quotidien ─────────────────────────────────
  //
  //  Base 10 mots/jour
  //  Modulé par :
  //  - Vélocité (mots ajoutés cette semaine)
  //  - Backlog (mots en attente depuis longtemps)
  //  - Discipline (ankiDone faits hier/avant-hier → récompense)
  //  Min 5, Max 30

  getDailyQuota() {
    const words   = Object.values(state.words);
    const now     = Date.now();
    const DAY     = 86_400_000;
    const today   = fmtDay(now);

    // Vélocité : mots ajoutés ces 7 derniers jours
    const recentWords = words.filter(w => {
      const created = w.createdAt || (w.occurrences[0] || 0);
      return (now - created) / DAY <= 7;
    }).length;
    const velocityBonus = Math.min(10, Math.floor(recentWords / 2));

    // Backlog : mots prêts depuis longtemps sans être sur Anki
    const backlog = words.filter(w => {
      if (w.ankiDone) return false;
      const created = w.createdAt || (w.occurrences[0] || 0);
      return (now - created) / DAY >= 7;
    }).length;
    const backlogBonus = Math.min(10, Math.floor(backlog / 5));

    // Discipline : si t'as marqué des mots ankiDone hier ou avant-hier → +2
    const yesterday    = fmtDay(now - DAY);
    const twoDaysAgo   = fmtDay(now - 2 * DAY);
    const recentAnki   = words.filter(w =>
      w.ankiDone && w.ankiDoneAt &&
      (fmtDay(w.ankiDoneAt) === yesterday || fmtDay(w.ankiDoneAt) === twoDaysAgo)
    ).length;
    const disciplineBonus = recentAnki > 0 ? 2 : 0;

    const quota = 10 + velocityBonus + backlogBonus + disciplineBonus;
    return Math.max(5, Math.min(30, quota));
  },

  // ── Liste des mots du jour ────────────────────────────────────

  getDailyWords() {
    const quota = this.getDailyQuota();
    const words = Object.values(state.words);

    // Calculer le score pour chaque mot éligible
    const scored = words
      .filter(w => !w.ankiDone && w.occurrences && w.occurrences.length > 0)
      .map(w => ({ word: w, score: this.scoreWord(w) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, quota);

    return scored.map(({ word, score }) => ({
      word,
      score,
      reason: this.getReason(word),
    }));
  },
};
