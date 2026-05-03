'use strict';

// ════════════════════════════════════════════════════════════════
//  SPELLING — Dictée français avec répétition espacée
//  + Timer 10s par mot + Vue des règles + Pause sur règle
// ════════════════════════════════════════════════════════════════

const SPELLING_RULES = {
  'beaucoup':          { rule: 'Un seul mot', tip: '"Beau" + "coup" soudés. Jamais "beau coup" en deux mots dans ce sens.' },
  "aujourd'hui":       { rule: 'Locution soudée', tip: 'Contraction de "au jour d\'hui". S\'écrit toujours en un mot avec trait d\'union.' },
  'peut-être':         { rule: 'Toujours un trait d\'union', tip: 'À ne pas confondre avec "peut être" (verbe pouvoir + infinitif être).' },
  'quand même':        { rule: 'Deux mots, sans trait d\'union', tip: 'Contrairement à "néanmoins" ou "pourtant", "quand même" reste en deux mots.' },
  "c'est-à-dire":      { rule: 'Trois traits d\'union', tip: 'Locution figée. Toujours "c\'est-à-dire" avec les deux traits d\'union.' },
  "quelqu'un":         { rule: 'Élision du E', tip: '"Quelqu\'" s\'écrit avec apostrophe devant "un". Le féminin est "quelqu\'une".' },
  'quelque chose':     { rule: 'Deux mots', tip: 'Toujours deux mots séparés. "Quelquechose" n\'existe pas.' },
  'nulle part':        { rule: 'Deux mots', tip: '"Nulle" s\'accorde en genre avec "part" (féminin). Toujours deux mots.' },
  'vis-à-vis':         { rule: 'Locution à traits d\'union', tip: 'Toujours avec les deux traits d\'union, qu\'il soit préposition ou nom.' },
  'dorénavant':        { rule: 'Un seul mot', tip: 'Contraction de "dès l\'heure en avant". Pas de trait d\'union.' },
  'désormais':         { rule: 'Accent grave sur le E', tip: 'Contraction de "dès or mais". Un seul mot, pas "des ormais".' },
  'évidemment':        { rule: '-emment (pas -ament)', tip: 'Les adverbes en -ent font -emment : évident → évidemment.' },
  'différemment':      { rule: '-emment (pas -ament)', tip: 'Différent → différemment. Adjectifs en -ent → adverbe en -emment.' },
  'malheureusement':   { rule: 'Adverbe en -ment', tip: 'Base : "malheureuse" (féminin) + "-ment".' },
  'heureusement':      { rule: 'Adverbe en -eusement', tip: 'Base : "heureuse" (féminin de heureux) + "-ment".' },
  'vraiment':          { rule: 'Pas de E avant -ment', tip: 'Exception : "vrai" + "ment" directement, sans le E du féminin.' },
  'appeler':           { rule: 'Double L aux formes conjuguées', tip: '"Appeler" → j\'appelle, tu appelles. Mais infinitif : appeler.' },
  'jeter':             { rule: 'Double T aux formes conjuguées', tip: '"Jeter" → je jette. Mais pas à l\'infinitif.' },
  'acheter':           { rule: 'Accent grave (pas double T)', tip: '"Acheter" → j\'achète. Contrairement à "jeter" qui double le T.' },
  'préférer':          { rule: 'Deux accents aigus', tip: 'Pré-fé-rer : les deux E portent un accent aigu à l\'infinitif.' },
  'œil':               { rule: 'Ligature OE', tip: '"Œ" est une ligature. Le pluriel est "yeux" (forme irrégulière).' },
  'cœur':              { rule: 'Ligature OE', tip: '"Œ" est une ligature typographique. Jamais "coeur" en français correct.' },
  'sœur':              { rule: 'Ligature OE', tip: '"Sœ" avec ligature, comme cœur et œil.' },
  'développement':     { rule: 'Double P, un seul L', tip: 'Dé-ve-lop-pe-ment : double P mais un seul L.' },
  'appartement':       { rule: 'Double P, double T', tip: 'Ap-par-te-ment : double P (appui) et double T (attention).' },
  'gouvernement':      { rule: 'Pas de E muet intérieur', tip: 'Gou-ver-ne-ment : le "e" de "gouverne" reste. Pas "gouvernment".' },
  'environnement':     { rule: 'Double N', tip: 'Envi-ron-ne-ment : double N, comme "donner", "sonner".' },
  'enveloppe':         { rule: 'Double P en finale', tip: '"Enveloppe" se termine en -oppe. Comme "nappe", "grappe".' },
  'chauffeur':         { rule: 'AU + FF', tip: 'Chauf-feur : "au" (comme chaud) + double F. Vient de "chauffer".' },
  'cauchemar':         { rule: 'Pas de E final', tip: '"Cauchemar" sans E final. Vient du flamand "mare" (fantôme).' },
  'accueil':           { rule: 'CU + EIL', tip: '"Accueil" : AC + CU + EIL. Le CU préserve le son [k] devant E.' },
  'écureuil':          { rule: 'CU + EUIL', tip: 'É-cu-reuil : le CU garde le son [k] devant eu.' },
  'portefeuille':      { rule: 'Composé PORTE + FEUILLE', tip: '"Portefeuille" : un seul mot. Pas de S à feuille.' },
  'grenouille':        { rule: 'Terminaison -OUILLE', tip: '-ouille : grenouille, brouille, rouille. Attention au double L.' },
  'brouillon':         { rule: 'Terminaison -OUILLON', tip: 'Brou-il-lon : double L + -on. Famille : bouillon, tourbillon.' },
  'soixante':          { rule: 'X pour le son [s]', tip: '"Soixante" : le X se prononce [s]. Soixante = 60.' },
  'soixante-dix':      { rule: 'Trait d\'union', tip: '70 = soixante-dix. 80 = quatre-vingts (avec S). 90 = quatre-vingt-dix (sans S).' },
  'quatre-vingts':     { rule: 'S uniquement à vingt seul', tip: '"Quatre-vingts" prend un S car vingt est seul. Mais "quatre-vingt-dix" sans S.' },
  'deuxième':          { rule: 'Accent grave sur le E', tip: 'Deux-ième : accent grave. Même logique pour troisième, quatrième...' },
  'rythme':            { rule: 'Y grec + TH', tip: '"Rythme" vient du grec "rhythmos". Y remplace le I.' },
  'abîme':             { rule: 'Accent circonflexe sur I', tip: '"Abîme" : le î marque un S disparu (abisme en latin).' },
  'symptôme':          { rule: 'Y grec + accent sur Ô', tip: 'Symp-tô-me : Y grec et Ô avec accent circonflexe.' },
  'diplôme':           { rule: 'Accent sur le Ô', tip: '"Diplôme" : le Ô porte un accent circonflexe.' },
  'île':               { rule: 'Accent circonflexe sur I', tip: '"Île" : le î marque un S disparu (isle en latin).' },
  'château':           { rule: 'Accent sur le Â', tip: '"Château" : â avec circonflexe. Pluriel : châteaux.' },
  'fête':              { rule: 'Accent sur le E', tip: '"Fête" : ê avec circonflexe (latin "festa").' },
  'fenêtre':           { rule: 'Accent sur le E intérieur', tip: '"Fenêtre" : le ê marque un S disparu (fenestre en latin).' },
  'forêt':             { rule: 'Accent sur E + T final muet', tip: '"Forêt" : ê avec circonflexe, T final muet.' },
  'intérêt':           { rule: 'Deux accents différents', tip: '"Intérêt" : é (aigu) puis ê (circonflexe). T final muet.' },
  'connaissance':      { rule: 'Double N + AISS', tip: 'Con-nais-sance : double N, puis -aiss- (comme naître).' },
  'expression':        { rule: 'X = [ks] + -ssion', tip: 'Ex-pres-sion : le X se prononce [ks]. Double S.' },
  'impression':        { rule: 'Double S dans -ssion', tip: 'Im-pres-sion : double S. Famille : imprimer → impression.' },
  'attention':         { rule: 'Double T + -tion', tip: 'At-ten-tion : double T, terminaison -tion.' },
  'exception':         { rule: 'X + -tion (pas -ssion)', tip: 'Ex-cep-tion : pas de double S ici ! -tion simple.' },
  'illégal':           { rule: 'Double L au préfixe IL-', tip: 'Devant L, "in-" devient "il-" : il-légal, il-lisible, il-logique.' },
  'immense':           { rule: 'Double M au préfixe IM-', tip: 'Devant M, "in-" devient "im-" : im-mense, im-meuble.' },
  'irréel':            { rule: 'Double R au préfixe IR-', tip: 'Devant R, "in-" devient "ir-" : ir-réel, ir-régulier.' },
  'chrysanthème':      { rule: 'CH + Y + TH grec', tip: 'Chry-san-thème : CH (son [k]), Y grec, TH grec. Du grec "or" + "fleur".' },
  'cacahuète':         { rule: 'Accent grave sur le E', tip: 'Ca-ca-huète : le "hu" = [u], E avec accent grave. De l\'espagnol.' },
  'acquérir':          { rule: 'CQU (pas just C)', tip: 'Ac-qué-rir : groupe CQU rare mais fixe. Famille : acquis, acquisition.' },
  'acquit':            { rule: 'T final muet', tip: '"Acquit" T final muet. "Pour acquit" : formule de reçu.' },
  'orgueil':           { rule: 'GU + EIL', tip: 'Or-gueil : le U après G garde le son [g] dur devant E.' },
  'recueillir':        { rule: 'CU + EILL', tip: 'Re-cueill-ir : le CU préserve le son [k] devant EU.' },
  'oignon':            { rule: 'OI + GN', tip: '"Oignon" : graphie historique. Nouvelle orthographe admet "ognon".' },
  'clé':               { rule: 'Accent aigu ou E muet ?', tip: '"Clé" avec accent aigu. "Clef" (avec F) est aussi accepté.' },
  'nénuphar':          { rule: 'PH pour le son F', tip: 'Né-nu-phar : PH vient du persan. "Nénufar" aussi accepté.' },
  'naïf':              { rule: 'Tréma sur le I', tip: '"Naïf" : tréma sur I — A et I se prononcent séparément [a-i].' },
  'naïve':             { rule: 'Tréma sur le I', tip: '"Naïve" : même règle. Famille : naïvement, naïveté.' },
  'laïque':            { rule: 'Tréma sur le I', tip: '"Laïque" : ï = A et I sont deux syllabes distinctes [la-i-k].' },
  'coïncidence':       { rule: 'Tréma sur le I', tip: '"Coïncider" : tréma sépare CO et IN. [ko-ɛ̃-si-dans].' },
  'ambiguë':           { rule: 'Tréma sur le E final', tip: '"Ambiguë" : tréma indique que le U se prononce.' },
  'Noël':              { rule: 'Tréma sur le E', tip: '"Noël" : tréma sur E = O et E se prononcent séparément [no-ɛl].' },
  'maïs':              { rule: 'Tréma sur le I', tip: '"Maïs" : tréma sépare A et I [ma-is]. Sans tréma = "mais" (conjonction).' },
  'événement':         { rule: 'Deux accents aigus', tip: 'É-vé-ne-ment : les deux premiers E portent des accents aigus.' },
  'entraînement':      { rule: 'Accent circonflexe sur Î', tip: 'En-traî-ne-ment : le î porte un circonflexe. Famille : traîner.' },
  'connaître':         { rule: 'Accent sur le Î devant T', tip: '"Connaître" : le î se marque devant T. Famille : paraître, naître.' },
  'paraître':          { rule: 'Accent sur le Î devant T', tip: '"Paraître" : comme "connaître", î devant T.' },
  'appât':             { rule: 'Accent circonflexe sur Â', tip: '"Appât" : â avec circonflexe. Famille : appâter.' },
  'châtiment':         { rule: 'Accent sur le Â', tip: '"Châtiment" : â avec circonflexe. Famille : châtier.' },
  'nonchalance':       { rule: 'Non + chalant', tip: 'Non-cha-lance : "non" + "chalant" (qui se soucie). = indifférence tranquille.' },
  'vraisemblance':     { rule: 'Composé VRAI + SEMBLANT', tip: 'Vrai-sem-blance : "vrai" + "semblant". Ce qui semble vrai.' },
  'ecchymose':         { rule: 'CC + H grec', tip: 'Ec-chy-mose : double C + CH (son [k]) + Y grec. Piège classique !' },
  'psychiatre':        { rule: 'PS + Y grec (P muet)', tip: 'Psy-chiatre : le P de PS est muet ! Du grec "âme".' },
  'psychologie':       { rule: 'PS + Y grec (P muet)', tip: 'Psy-cho-logie : P muet. "Psycho" = âme en grec.' },
  'rhumatisme':        { rule: 'RH + U initial', tip: 'Rhu-ma-tisme : RH vient du grec. Famille : rhume, rhinocéros.' },
  'mnémotechnique':    { rule: 'MN initial (M muet)', tip: 'Mné-mo-technique : le M initial est muet ! Du grec "mémoire".' },
  'gaieté':            { rule: 'Deux orthographes', tip: '"Gaieté" ou "gaîté" sont toutes les deux acceptées.' },
  'exprès':            { rule: 'Accent grave final', tip: '"Exprès" (adverbe) : accent grave. ≠ "express" (train, sans accent).' },
  'procès':            { rule: 'Accent grave sur le E final', tip: '"Procès" : è avec accent grave, S final.' },
  'succès':            { rule: 'Double C + accent grave', tip: 'Suc-cès : double C, puis accent grave sur le è final.' },
  'palais':            { rule: 'AI + S final muet', tip: '"Palais" : AI se prononce [ɛ], S final muet.' },
};

const SPELLING_WORDS = {
  debutant: [
    "beaucoup","maintenant","quelque chose","aujourd'hui","toujours","souvent",
    "vraiment","jamais","encore","personne","ensemble","seulement","tellement",
    "longtemps","autrement","facilement","simplement","rapidement","lentement",
    "finalement","heureusement","malheureusement","différemment","certainement",
    "absolument","complètement","exactement","normalement","évidemment",
    "quand même","pourtant","cependant","néanmoins","également","notamment",
    "parfois","quelquefois","dorénavant","désormais","auparavant",
    "bientôt","tantôt","aussitôt","plutôt","surtout","partout","nulle part",
    "quelqu'un","peut-être","vis-à-vis","c'est-à-dire","là-bas","là-haut",
    "appeler","jeter","acheter","geler","modeler","amener","emmener","promener",
    "préférer","espérer","céder","gérer","répéter","compléter",
    "maison","famille","enfant","travail","argent","temps","monde",
    "ville","pays","chose","personne","place","corps","main","tête",
    "pied","œil","cœur","sœur","voix","nuit","jour","semaine","mois","année",
    "ami","amie","frère","père","mère","fils","fille",
    "homme","femme","garçon","adulte","jeune","vieux",
    "grand","petit","gros","beau","fort","faible",
    "heureux","triste","content","surpris","inquiet","tranquille",
  ],
  intermediaire: [
    "développement","appartement","gouvernement","environnement","investissement",
    "établissement","renseignement","comportement","changement","traitement",
    "enveloppe","cauchemar","chauffeur","chaussure","chaussée",
    "accueil","écureuil","portefeuille","grenouille","citrouille","rouille",
    "paille","maille","bataille","médaille","muraille","ferraille",
    "brouillon","bouillon","tourbillon","vermillon",
    "appareil","soleil","sommeil","réveil","pareil","conseil",
    "genou","caillou","hibou","chou","bijou","trou","verrou",
    "ennui","bruit","fruit","circuit","produit","réduit",
    "feuille","vieille","groseille","oreille","corbeille","abeille",
    "accorder","accepter","accompagner","affirmer","agrandir",
    "illégal","illimité","illisible","illogique",
    "immense","immeuble","immigration","immédiat","immortel",
    "innombrable","innocent","inutile","irréel","irrégulier","irresponsable",
    "connaissance","reconnaissance",
    "transmission","commission","permission","émission","admission",
    "addition","condition","tradition","position","solution","conclusion",
    "attention","intention","mention","tension","extension","dimension",
    "exception","conception","perception","réception","description","inscription",
    "expression","impression","compression","passion","mission","discussion",
    "soixante","soixante-dix","quatre-vingts","quatre-vingt-dix",
    "deuxième","troisième","quatrième","cinquième","sixième","septième",
    "rythme","abîme","symptôme","diplôme","fantôme",
    "île","château","gâteau","fête","bête","crête","fenêtre","ancêtre",
    "forêt","intérêt","arrêt","prêt",
  ],
  avance: [
    "chrysanthème","cacahuète","mezzanine",
    "exprès","procès","succès","accès","excès",
    "palais","marais","délai","balai","essai","rabais",
    "acquis","requis","acquit","acquérir",
    "orgueil","recueillir",
    "oignon","clé","nénuphar",
    "hôpital","hôtel","hôtesse","honneur","honnête",
    "héros","héroïne","héroïque",
    "hypothèse","hydraulique",
    "ecchymose","psychiatre","psychologie","rhumatisme","mnémotechnique",
    "naïf","naïve","laïque","coïncidence","Noël","maïs",
    "ambiguë",
    "événement","entraînement","connaître","paraître",
    "appât","châtiment",
    "nonchalance","vraisemblance",
    "gaieté","exprès",
    "secrétariat","circonstance",
    "indispensable","incontournable","incompréhensible",
    "irrémédiable","irrécupérable","irréfutable",
  ],
};

// ── Engine ────────────────────────────────────────────────────

const Spelling = {
  queue:        [],
  current:      null,
  sessionDone:  0,
  sessionTotal: 0,
  level:        'debutant',

  // ── Timer 10s ─────────────────────────────────────────────
  _countdown:   10,
  _countTimer:  null,
  _paused:      false,

  _startCountdown() {
    this._clearCountdown();
    this._countdown = 10;
    this._paused    = false;
    this._renderCountdown();

    this._countTimer = setInterval(() => {
      if (this._paused) return;
      this._countdown--;
      this._renderCountdown();
      if (this._countdown <= 0) {
        this._clearCountdown();
        this._timeUp();
      }
    }, 1000);
  },

  _clearCountdown() {
    clearInterval(this._countTimer);
    this._countTimer = null;
  },

  _pauseCountdown()  { this._paused = true;  },
  _resumeCountdown() { this._paused = false; },

  _renderCountdown() {
    const el = document.getElementById('spellingCountdown');
    if (!el) return;
    const cls = this._countdown <= 3 ? 'countdown-red' : this._countdown <= 6 ? 'countdown-orange' : 'countdown-green';
    el.innerHTML = `<div class="spelling-countdown-pill ${cls}">
      <span class="countdown-seconds">${this._countdown}</span><span class="countdown-label">s</span>
    </div>`;
  },

  _timeUp() {
    // Temps écoulé = traité comme une erreur
    const correct = this.current?.label;
    if (!correct) return;
    this.current.streak = 0;
    this._showFeedback(false, correct, true); // true = timeout
    this.queue.splice(Math.min(2, this.queue.length), 0, { ...this.current });
    this._updateProgress();
  },

  // ── Session ───────────────────────────────────────────────

  start(level) {
    this._clearCountdown();
    this.level = level || this.level;
    const words = SPELLING_WORDS[this.level];
    this.queue = [...words].map(w => ({ label: w, streak: 0 }));
    this._shuffle(this.queue);
    this.sessionDone  = 0;
    this.sessionTotal = 0;
    this.current      = null;
    this._renderUI();
    this._next();
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  },

  _next() {
    this._clearCountdown();
    if (!this.queue.length) { this._showFinished(); return; }
    this.current = this.queue.shift();
    this.sessionTotal++;
    this._renderWord();
    setTimeout(() => {
      this._speak(this.current.label);
      this._startCountdown();
    }, 150);
  },

  _speak(word) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const doSpeak = () => {
      const utt   = new SpeechSynthesisUtterance(word);
      utt.lang    = 'fr-FR';
      utt.rate    = 0.82;
      const btn   = document.getElementById('spellingListenBtn');
      if (btn) btn.classList.add('speaking');
      utt.onend   = () => { if (btn) btn.classList.remove('speaking'); };
      utt.onerror = () => { if (btn) btn.classList.remove('speaking'); };
      const voices  = window.speechSynthesis.getVoices();
      const frVoice = voices.find(v => v.lang === 'fr-FR') || voices.find(v => v.lang.startsWith('fr'));
      if (frVoice) utt.voice = frVoice;
      window.speechSynthesis.speak(utt);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { doSpeak(); }
    else {
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); };
      setTimeout(() => { if (!window.speechSynthesis.speaking) doSpeak(); }, 800);
    }
  },

  validate() {
    const inp     = document.getElementById('spellingInput');
    const answer  = (inp?.value || '').trim().toLowerCase();
    const correct = this.current?.label?.toLowerCase();
    if (!answer || !correct) return;
    this._clearCountdown();

    const norm = s => s.replace(/'/g, "'").toLowerCase().trim();
    const isOk = norm(answer) === norm(correct);

    if (isOk) {
      this.sessionDone++;
      this.current.streak++;
      this._showFeedback(true, this.current.label);
      if (this.current.streak < 2) {
        this.queue.splice(Math.min(4, this.queue.length), 0, { ...this.current });
      }
    } else {
      this.current.streak = 0;
      this._showFeedback(false, this.current.label);
      this.queue.splice(Math.min(2, this.queue.length), 0, { ...this.current });
    }
    this._updateProgress();
  },

  _renderUI() {
    const c = document.getElementById('spellingContent');
    if (!c) return;
    const levelLabel = { debutant: '🟢 Débutant', intermediaire: '🟡 Intermédiaire', avance: '🔴 Avancé' }[this.level];
    c.innerHTML = `
      <div class="spelling-card" id="spellingCard">
        <div class="spelling-top-bar">
          <div id="spellingCountdown"></div>
          <div class="spelling-level-badge">${levelLabel}</div>
        </div>
        <div class="spelling-progress-wrap">
          <div class="spelling-progress-bar" id="spellingProgressBar"></div>
        </div>
        <div class="spelling-stats-row">
          <span id="spellingStatCorrect" class="spelling-stat-good">0 ✓</span>
          <span id="spellingStatTotal"   class="spelling-stat-total">0 joués</span>
          <span id="spellingStatQueue"   class="spelling-stat-queue">0 restants</span>
        </div>
        <div class="spelling-listen-area">
          <button class="spelling-listen-btn" id="spellingListenBtn" onclick="Spelling._replay()">🔊</button>
          <div class="spelling-word-hint" id="spellingWordHint"></div>
          <div class="spelling-hint">Appuie pour réécouter</div>
        </div>
        <div class="spelling-input-row">
          <input type="text" id="spellingInput" class="spelling-input"
            placeholder="Écris le mot…"
            autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
          <button class="btn spelling-validate-btn" onclick="Spelling.validate()">✓</button>
        </div>
        <div class="spelling-feedback" id="spellingFeedback"></div>
        <div class="spelling-actions">
          <button class="btn btn-ghost btn-sm" onclick="Spelling._skip()">Passer →</button>
          <button class="btn btn-ghost btn-sm" onclick="renderSpelling(true)">Changer niveau</button>
        </div>
      </div>`;
    setTimeout(() => {
      const inp = document.getElementById('spellingInput');
      if (inp) {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') Spelling.validate(); });
        inp.focus();
      }
    }, 100);
  },

  _renderWord() {
    const fb   = document.getElementById('spellingFeedback');
    const inp  = document.getElementById('spellingInput');
    const hint = document.getElementById('spellingWordHint');
    if (fb)   fb.innerHTML = '';
    if (inp)  { inp.value = ''; inp.disabled = false; inp.focus(); }
    if (hint && this.current) {
      hint.textContent = `${this.current.label.length} lettre${this.current.label.length > 1 ? 's' : ''}`;
    }
    this._updateProgress();
  },

  _showFeedback(isOk, correctWord, timeout = false) {
    const fb  = document.getElementById('spellingFeedback');
    const inp = document.getElementById('spellingInput');
    if (!fb) return;

    const rule    = SPELLING_RULES[correctWord] || SPELLING_RULES[correctWord.toLowerCase()];
    const ruleBtn = rule
      ? `<button class="spelling-rule-btn" onclick="Spelling.showRule('${correctWord.replace(/'/g, "\\'")}')">? règle</button>`
      : '';

    if (isOk) {
      fb.innerHTML = `<div class="spelling-ok-row"><div class="spelling-ok">✓ Correct !</div>${ruleBtn}</div>`;
      if (inp) inp.disabled = true;
      setTimeout(() => { if (Spelling.current) Spelling._next(); }, 1000);
    } else {
      const typed = timeout ? '⏱ Temps écoulé' : (inp?.value?.trim() || '');
      fb.innerHTML = `
        <div class="spelling-wrong">${timeout ? '⏱ Trop lent !' : '✗ Raté'}</div>
        <div class="spelling-correction">
          <span class="spelling-typed">${escHtml(typed)}</span>
          ${!timeout ? '<span class="spelling-arrow"> → </span>' : ''}
          <span class="spelling-correct">${escHtml(correctWord)}</span>
          ${ruleBtn}
        </div>`;
      if (inp) inp.disabled = true;
      setTimeout(() => { if (Spelling.current) Spelling._next(); }, 3000);
    }
  },

  // ── Popup règle (pause le timer) ─────────────────────────

  showRule(word) {
    this.closeRule();
    const rule = SPELLING_RULES[word] || SPELLING_RULES[word.toLowerCase()];
    if (!rule) return;

    // Pause le countdown
    this._pauseCountdown();

    const popup = document.createElement('div');
    popup.id        = 'spellingRulePopup';
    popup.className = 'spelling-rule-popup-v2';
    popup.innerHTML = `
      <button class="srule-close" onclick="Spelling.closeRule()">×</button>
      <div class="srule-word">${escHtml(word)}</div>
      <div class="srule-pill">${escHtml(rule.rule)}</div>
      <p class="srule-tip">${escHtml(rule.tip)}</p>
      <div class="srule-footer">Règle orthographique</div>`;

    document.body.appendChild(popup);

    const vw = window.innerWidth;
    if (vw < 600) {
      popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:' + (vw - 32) + 'px;max-width:400px;z-index:9999';
      const ov = document.createElement('div');
      ov.id = 'spellingRuleOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998';
      ov.addEventListener('click', () => this.closeRule());
      document.body.appendChild(ov);
    } else {
      const btn  = document.querySelector('.spelling-rule-btn');
      const rect = btn ? btn.getBoundingClientRect() : { bottom: 200, left: 100 };
      popup.style.cssText = 'position:fixed;top:' + (rect.bottom + 8) + 'px;left:' + Math.max(8, rect.left - 120) + 'px;z-index:9999;max-width:320px';
    }

    const close = e => {
      if (e.key === 'Escape' || !popup.contains(e.target)) {
        this.closeRule();
        document.removeEventListener('keydown', close);
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(() => {
      document.addEventListener('keydown', close);
      document.addEventListener('mousedown', close);
    }, 0);
  },

  closeRule() {
    document.getElementById('spellingRulePopup')?.remove();
    document.getElementById('spellingRuleOverlay')?.remove();
    // Reprendre le countdown si on était en session
    this._resumeCountdown();
  },

  _replay() {
    if (this.current) {
      this._speak(this.current.label);
      // Remettre le timer à 10 si on réécoute
      this._countdown = 10;
      this._renderCountdown();
    }
  },

  _skip() {
    if (!this.current) return;
    this._clearCountdown();
    window.speechSynthesis.cancel();
    this.queue.push({ ...this.current, streak: 0 });
    this._next();
  },

  _updateProgress() {
    const pct = this.sessionTotal > 0 ? Math.round(this.sessionDone / this.sessionTotal * 100) : 0;
    const bar = document.getElementById('spellingProgressBar');
    const sc  = document.getElementById('spellingStatCorrect');
    const st  = document.getElementById('spellingStatTotal');
    const sq  = document.getElementById('spellingStatQueue');
    if (bar) bar.style.width = pct + '%';
    if (sc)  sc.textContent  = this.sessionDone + ' ✓';
    if (st)  st.textContent  = this.sessionTotal + ' joués';
    if (sq)  sq.textContent  = this.queue.length + ' restants';
  },

  _showFinished() {
    this._clearCountdown();
    const c   = document.getElementById('spellingContent');
    const pct = this.sessionTotal > 0 ? Math.round(this.sessionDone / this.sessionTotal * 100) : 0;
    const msg = pct >= 80 ? '🔥 Excellent !' : pct >= 60 ? '👍 Bien !' : '💪 Continue !';
    if (c) c.innerHTML = `
      <div class="spelling-finished">
        <div class="spelling-finished-icon">🎉</div>
        <div class="spelling-finished-title">Session terminée !</div>
        <div class="spelling-finished-score">${this.sessionDone} / ${this.sessionTotal} — ${pct}%</div>
        <div class="spelling-finished-msg">${msg}</div>
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;justify-content:center">
          <button class="btn" onclick="Spelling.start()">Recommencer</button>
          <button class="btn btn-ghost" onclick="renderSpelling(true)">Changer niveau</button>
        </div>
      </div>`;
  },
};

// ── Écran d'accueil avec vue des règles ───────────────────────

function renderSpelling(forceMenu) {
  const c = document.getElementById('spellingContent');
  if (!c) return;

  if (forceMenu || (!Spelling.current && !Spelling.sessionTotal)) {
    // Construire la liste des règles disponibles
    const rulesHtml = Object.entries(SPELLING_RULES).map(([word, r]) => `
      <div class="spelling-rules-item">
        <span class="spelling-rules-word">${escHtml(word)}</span>
        <span class="spelling-rules-rule">${escHtml(r.rule)}</span>
        <span class="spelling-rules-tip">${escHtml(r.tip)}</span>
      </div>`).join('');

    c.innerHTML = `
      <div class="spelling-start">
        <div class="spelling-start-icon">🎧</div>
        <div class="spelling-start-title">Spelling</div>
        <div class="spelling-start-desc">
          Écoute le mot et écris-le en moins de <strong>10 secondes</strong>.<br>
          Les mots ratés reviennent plus tôt.
        </div>

        <div class="spelling-levels">
          <button class="spelling-level-btn level-easy" onclick="Spelling.start('debutant')">
            <span class="level-dot">🟢</span>
            <span class="level-name">Débutant</span>
            <span class="level-count">${SPELLING_WORDS.debutant.length} mots</span>
            <span class="level-desc">Mots courants, adverbes, vie quotidienne</span>
          </button>
          <button class="spelling-level-btn level-mid" onclick="Spelling.start('intermediaire')">
            <span class="level-dot">🟡</span>
            <span class="level-name">Intermédiaire</span>
            <span class="level-count">${SPELLING_WORDS.intermediaire.length} mots</span>
            <span class="level-desc">Accents, doubles lettres, suffixes en -tion</span>
          </button>
          <button class="spelling-level-btn level-hard" onclick="Spelling.start('avance')">
            <span class="level-dot">🔴</span>
            <span class="level-name">Avancé</span>
            <span class="level-count">${SPELLING_WORDS.avance.length} mots</span>
            <span class="level-desc">Mots pièges, trémas, étymologie</span>
          </button>
        </div>

        <div class="spelling-rules-section">
          <button class="spelling-rules-toggle" onclick="
            const b = document.getElementById('spellingRulesBody');
            const isOpen = b.style.display !== 'none';
            b.style.display = isOpen ? 'none' : 'block';
            this.textContent = isOpen ? '📖 Voir toutes les règles (${Object.keys(SPELLING_RULES).length})' : '▲ Masquer les règles';
          ">📖 Voir toutes les règles (${Object.keys(SPELLING_RULES).length})</button>
          <div id="spellingRulesBody" style="display:none" class="spelling-rules-body">
            ${rulesHtml}
          </div>
        </div>
      </div>`;
  }
}
