'use strict';

// ════════════════════════════════════════════════════════════════
//  SPELLING — Dictée français avec répétition espacée
//  Liste de mots intégrée, indépendante du lexique anglais
// ════════════════════════════════════════════════════════════════

// ── Liste de mots par niveau ──────────────────────────────────

const SPELLING_WORDS = {
  debutant: [
    'beaucoup','maintenant','quelque chose','aujourd\'hui','toujours','souvent',
    'vraiment','jamais','encore','personne','ensemble','seulement','tellement',
    'longtemps','autrement','facilement','simplement','rapidement','lentement',
    'finalement','heureusement','malheureusement','différemment','certainement',
    'absolument','complètement','exactement','normalement','évidemment',
    'quand même','pourtant','cependant','néanmoins','également','notamment',
    'également','parfois','quelquefois','dorénavant','désormais','auparavant',
    'bientôt','tantôt','aussitôt','plutôt','surtout','partout','nulle part',
    'quelqu\'un','quelques-uns','n\'importe','peut-être','vis-à-vis',
    'c\'est-à-dire','là-bas','là-haut','là-dedans','au-dessus','au-dessous',
    'appeler','jeter','acheter','geler','modeler','peler','ciseler',
    'amener','emmener','promener','élever','enlever','soulever',
    'préférer','espérer','céder','gérer','répéter','compléter',
    'maison','famille','enfant','travail','argent','temps','monde',
    'ville','pays','chose','personne','place','corps','main','tête',
    'pied','œil','cœur','voix','nuit','jour','semaine','mois','année',
    'ami','amie','frère','sœur','père','mère','fils','fille',
    'homme','femme','garçon','fille','enfant','adulte','jeune','vieux',
    'grand','petit','gros','maigre','beau','laid','fort','faible',
    'heureux','triste','content','fâché','surpris','inquiet','tranquille',
  ],

  intermediaire: [
    'développement','appartement','gouvernement','environnement','investissement',
    'établissement','renseignement','comportement','changement','traitement',
    'enveloppe','carrosse','charrette','charron','charroi','bourrasque',
    'chauffeur','cauchemar','fauteuil','chaussure','chaussette','chaussée',
    'accueil','écureuil','portefeuille','grenouille','citrouille','rouille',
    'paille','maille','bataille','médaille','muraille','ferraille','ferronnerie',
    'brouillon','bouillon','rouillon','tourbillon','vermillon','cotillon',
    'appareil','soleil','sommeil','réveil','pareil','conseil','vitrail',
    'genou','caillou','hibou','joujou','chou','pou','bijou','trou','verrou',
    'ennui','nuit','bruit','fruit','circuit','recuit','produit','réduit',
    'abbaye','crayon','moyen','rayon','brouillon','doyen','octroyer',
    'feuille','vieille','treille','groseille','oreille','corbeille','abeille',
    'accorder','accrocher','accepter','accompagner','accomplir','accumuler',
    'affirmer','affliger','affranchir','aggraver','agrandir','agresser',
    'illégal','illimité','illisible','illogique','illuminer','illustrer',
    'immense','immeuble','immigration','immédiat','immerger','immortel',
    'innombrable','innocent','inutile','irréel','irrégulier','irresponsable',
    'connaissance','reconnaissance','méconnaissance','méconnaître',
    'transmission','commission','permission','omission','émission','admission',
    'addition','condition','tradition','position','solution','conclusion',
    'attention','intention','mention','tension','extension','dimension',
    'exception','conception','perception','réception','description','inscription',
    'profession','confession','expression','impression','compression','oppression',
    'passion','mission','discussion','succession','percussion','concession',
    'soixante','soixante-dix','quatre-vingts','quatre-vingt-dix',
    'deuxième','troisième','quatrième','cinquième','sixième','septième',
    'huitième','neuvième','dixième','vingtième','centième','millième',
    'rythme','abîme','symptôme','diplôme','fantôme','atome','dôme',
    'île','pôle','rôle','côle','drôle','contrôle','parôle',
    'âge','âme','grâce','câble','châtaigne','château','gâteau',
    'fête','bête','tête','crête','fenêtre','ancêtre','guêpe',
    'forêt','intérêt','arrêt','prêt','apprêt',
  ],

  avance: [
    'chrysanthème','cacahuète','gazpacho','mezzanine','pizzeria',
    'châssis','dessous','dessus','exprès','procès','succès','accès','excès',
    'palais','marais','délai','balai','essai','relai','rabais',
    'biais','gais','vrais','parfaits','attraits','distraits',
    'acquis','requis','acquit','acquitter','acquérir','acquéreur',
    'guimauve','guirlande','guide','guêpe','guérir','guère',
    'cueillie','accueillie','orgueil','orgueilleuse','recueillir',
    'yaourt','yeux','yeuse','yéti',
    'honte','hôpital','hôtel','hôtesse','hôte','inhospitalier',
    'heure','honneur','honnête','honnêteté','honoraire','honorifique',
    'herbe','herbier','herbivore','hercule','héros','héroïne','héroïque',
    'hiver','hivernal','hibou','hiérarchie','hiéroglyphe','hippodrome',
    'hypothèse','hypothétique','hydrogène','hydrographe','hydraulique',
    'millefeuille','portefeuille','grenouillère','citrouillette',
    'ecchymose','ecclésiaste','ecclésiastique',
    'oignon','soigner','grognon','rognon','besogneux','trognon',
    'clé','clef','blé','pré','gré','degré','progrès','succès',
    'secrétariat','secrétaire','secrètement','discrètement','concrètement',
    'eczéma','examen','exemple','exercice','exiger','exigeant','exil',
    'scénario','scène','science','sciemment','conscience','conscient',
    'psychiatre','psychologie','psychologique','psychanalyse',
    'rhumatisme','rhume','rhinocéros','rhubarbe',
    'mnémotechnique','mnémosyne',
    'aéroport','aéronautique','aérien','aérobic','aérosol',
    'naïf','naïve','naïvement','naïveté','laïque','laïcité','laïcisme',
    'Noël','Noëls','maïs','caïd','héroïne','coïncidence','coïncider',
    'ambiguë','ambiguïté','aiguë','ciguë','exiguë','contiguë',
    'nénuphar','nénuphars','nougat','nougats','prudhomme',
    'événement','avènement','dévouement','renouvellement','nivellement',
    'appât','appâter','repaître','connaître','paraître','disparaître',
    'naître','renaître','méconnaître','reconnaître',
    'entraînement','entraîner','traîneau','traîner','entraîneur',
    'châtiment','bâtiment','bâtir','bâton','débâcle','épitaphe',
    'gaieté','gaiement','gaîté','gaîment',
    'parmi','hormis','vis-à-vis','quant à','quant-à-soi',
    'nonchalance','nonchalant','nonchalamment',
    'vraisemblance','vraisemblable','vraisemblablement',
    'circonférence','circonspect','circonstance','circonvenir',
    'indispensable','incontournable','invraisemblable','incompréhensible',
    'irrémédiable','irrécupérable','irréfutable','irréprochable',
  ],
};

// ── Engine ────────────────────────────────────────────────────

const Spelling = {

  queue:        [],
  current:      null,
  sessionDone:  0,
  sessionTotal: 0,
  level:        'debutant', // 'debutant' | 'intermediaire' | 'avance'

  start(level) {
    this.level = level || this.level;
    const words = SPELLING_WORDS[this.level];

    // Copie mélangée
    this.queue = [...words]
      .map(w => ({ label: w, streak: 0 }));
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
    if (!this.queue.length) { this._showFinished(); return; }
    this.current = this.queue.shift();
    this.sessionTotal++;
    this._renderWord();
    setTimeout(() => this._speak(this.current.label), 150);
  },

  _speak(word) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const doSpeak = () => {
      const utt   = new SpeechSynthesisUtterance(word);
      utt.lang    = 'fr-FR';
      utt.rate    = 0.82;
      utt.pitch   = 1;

      const btn = document.getElementById('spellingListenBtn');
      if (btn) btn.classList.add('speaking');
      utt.onend  = () => { if (btn) btn.classList.remove('speaking'); };
      utt.onerror = () => { if (btn) btn.classList.remove('speaking'); };

      const voices  = window.speechSynthesis.getVoices();
      const frVoice = voices.find(v => v.lang === 'fr-FR') || voices.find(v => v.lang.startsWith('fr'));
      if (frVoice) utt.voice = frVoice;

      window.speechSynthesis.speak(utt);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
      setTimeout(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) doSpeak();
      }, 800);
    }
  },

  validate() {
    const inp     = document.getElementById('spellingInput');
    const answer  = (inp?.value || '').trim().toLowerCase();
    const correct = this.current?.label?.toLowerCase();
    if (!answer || !correct) return;

    // Normaliser : ignorer majuscules et apostrophes droites vs courbes
    const norm = s => s.replace(/'/g, "'").toLowerCase().trim();
    const isOk = norm(answer) === norm(correct);

    if (isOk) {
      this.sessionDone++;
      this.current.streak++;
      this._showFeedback(true, this.current.label);
      // Mot maîtrisé après 2 succès consécutifs
      if (this.current.streak < 2) {
        const at = Math.min(4, this.queue.length);
        this.queue.splice(at, 0, { ...this.current });
      }
    } else {
      this.current.streak = 0;
      this._showFeedback(false, this.current.label);
      // Raté → revient dans 2 mots
      const at = Math.min(2, this.queue.length);
      this.queue.splice(at, 0, { ...this.current });
    }
    this._updateProgress();
  },

  _renderUI() {
    const c = document.getElementById('spellingContent');
    if (!c) return;

    const levelLabel = {
      debutant:      '🟢 Débutant',
      intermediaire: '🟡 Intermédiaire',
      avance:        '🔴 Avancé',
    }[this.level];

    c.innerHTML = `
      <div class="spelling-card" id="spellingCard">
        <div class="spelling-level-badge">${levelLabel}</div>

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

  _showFeedback(isOk, correctWord) {
    const fb  = document.getElementById('spellingFeedback');
    const inp = document.getElementById('spellingInput');
    if (!fb) return;

    if (isOk) {
      fb.innerHTML = `<div class="spelling-ok">✓ Correct !</div>`;
      if (inp) inp.disabled = true;
      setTimeout(() => { if (Spelling.current) Spelling._next(); }, 900);
    } else {
      const typed = inp?.value?.trim() || '';
      // Afficher les lettres en couleur : vert = bon, rouge = mauvais
      fb.innerHTML = `
        <div class="spelling-wrong">✗ Raté</div>
        <div class="spelling-correction">
          <span class="spelling-typed">${escHtml(typed)}</span>
          <span class="spelling-arrow"> → </span>
          <span class="spelling-correct">${escHtml(correctWord)}</span>
        </div>`;
      if (inp) inp.disabled = true;
      setTimeout(() => { if (Spelling.current) Spelling._next(); }, 2500);
    }
  },

  _replay() { if (this.current) this._speak(this.current.label); },

  _skip() {
    if (!this.current) return;
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

// ── Écran d'accueil avec sélection du niveau ──────────────────

function renderSpelling(forceMenu) {
  const c = document.getElementById('spellingContent');
  if (!c) return;

  if (forceMenu || (!Spelling.current && !Spelling.sessionTotal)) {
    c.innerHTML = `
      <div class="spelling-start">
        <div class="spelling-start-icon">🎧</div>
        <div class="spelling-start-title">Dictée française</div>
        <div class="spelling-start-desc">Écoute le mot et écris-le correctement.<br>Les mots ratés reviennent plus tôt.</div>

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
            <span class="level-desc">Mots pièges, trémas, lettres muettes</span>
          </button>
        </div>
      </div>`;
  }
}
