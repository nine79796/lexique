'use strict';

// ════════════════════════════════════════════════════════════════
//  SPELLING — Dictée français avec répétition espacée
//  + Règles orthographiques par mot (popup style Wordnik)
// ════════════════════════════════════════════════════════════════

// ── Règles orthographiques ────────────────────────────────────
// Associe un mot à une règle courte + explication

const SPELLING_RULES = {
  // Débutant
  'beaucoup':          { rule: 'Un seul mot', tip: '"Beau" + "coup" soudés. Jamais "beau coup" en deux mots dans ce sens.' },
  'aujourd\'hui':      { rule: 'Locution soudée', tip: 'Contraction de "au jour d\'hui". S\'écrit toujours en un mot avec trait d\'union.' },
  'peut-être':         { rule: 'Toujours un trait d\'union', tip: 'Adverbe de doute. À ne pas confondre avec "peut être" (verbe pouvoir + infinitif être).' },
  'quand même':        { rule: 'Deux mots, sans trait d\'union', tip: 'Contrairement à "néanmoins" ou "pourtant", "quand même" reste en deux mots.' },
  'c\'est-à-dire':     { rule: 'Trois traits d\'union', tip: 'Locution figée. Toujours "c\'est-à-dire" avec les deux traits d\'union.' },
  'quelqu\'un':        { rule: 'Élision du E', tip: '"Quelqu\'" s\'écrit avec apostrophe devant "un". Le féminin est "quelqu\'une".' },
  'quelque chose':     { rule: 'Deux mots', tip: 'Toujours deux mots séparés. "Quelquechose" n\'existe pas.' },
  'nulle part':        { rule: 'Deux mots', tip: '"Nulle" s\'accorde en genre avec "part" (féminin). Toujours deux mots.' },
  'vis-à-vis':         { rule: 'Locution à traits d\'union', tip: 'Toujours avec les deux traits d\'union, qu\'il soit préposition ou nom.' },
  'dorénavant':        { rule: 'Un seul mot', tip: 'Contraction de "dès l\'heure en avant". Pas de trait d\'union.' },
  'désormais':         { rule: 'Accent grave sur le E', tip: 'Contraction de "dès or mais". Un seul mot, pas "des ormais".' },
  'évidemment':        { rule: '-emment (pas -ament)', tip: 'Les adverbes en -ent font -emment : évident → évidemment. Cf. prudemment, différemment.' },
  'différemment':      { rule: '-emment (pas -ament)', tip: 'Différent → différemment. La règle : adjectifs en -ent → adverbe en -emment.' },
  'malheureusement':   { rule: 'Adverbe long en -ment', tip: 'Base : "malheureuse" + "-ment". Penser à l\'adjectif féminin : malheureuse.' },
  'heureusement':      { rule: 'Adverbe en -eusement', tip: 'Base : "heureuse" (féminin de heureux) + "-ment".' },
  'vraiment':          { rule: 'Pas de E avant -ment', tip: 'Exception : "vrai" + "ment" directement, sans le E du féminin (vraie → vraiment).' },
  'appeler':           { rule: 'Double L ou accent ?', tip: '"Appeler" prend un double L aux formes conjuguées : j\'appelle, tu appelles. Mais : appeler à l\'infinitif.' },
  'jeter':             { rule: 'Double T ou accent ?', tip: '"Jeter" double le T : je jette, tu jettes. Mais pas à l\'infinitif.' },
  'acheter':           { rule: 'Accent grave (pas double T)', tip: '"Acheter" prend un accent grave : j\'achète — contrairement à "jeter" qui double le T.' },
  'préférer':          { rule: 'Deux accents aigus', tip: 'Pré-fé-rer : les deux E portent un accent aigu à l\'infinitif.' },
  'œil':               { rule: 'Ligature OE', tip: '"Œ" est une ligature. Le pluriel est "yeux" (forme irrégulière), pas "œils".' },
  'cœur':              { rule: 'Ligature OE', tip: '"Œ" est une ligature typographique française. Jamais "coeur" en français correct.' },
  'sœur':              { rule: 'Ligature OE', tip: '"Sœ" avec ligature, comme cœur et œil. Le O et le E sont liés.' },

  // Intermédiaire
  'développement':     { rule: 'Deux accents aigus + double P', tip: 'Dé-ve-lop-pe-ment : un seul L mais double P. Erreurs fréquentes : "développement" vs "developpement".' },
  'appartement':       { rule: 'Double P, double T', tip: 'Ap-par-te-ment : double P (comme appui) et double T (comme attention). Deux doublets.' },
  'gouvernement':      { rule: 'Pas de E muet intérieur', tip: 'Gou-ver-ne-ment : le "e" de "gouverne" reste même si peu prononcé. Pas "gouvernment".' },
  'environnement':     { rule: 'Double N', tip: 'Envi-ron-ne-ment : double N, comme "donner", "sonner". Pensez au radical "environ".' },
  'enveloppe':         { rule: 'Double P en finale', tip: '"Enveloppe" se termine en -oppe. Comme "nappe", "grappe". Pas "envelop".' },
  'chauffeur':         { rule: 'AU + FF', tip: 'Chauf-feur : "au" (comme chaud) + double F. Vient de "chauffer".' },
  'cauchemar':         { rule: 'Pas de E final', tip: '"Cauchemar" sans E final. Vient du flamand "mare" (fantôme). Parfois "cauchemar" avec S au pluriel.' },
  'accueil':           { rule: 'CU + EIL', tip: '"Accueil" : AC + CU + EIL. Le CU préserve le son [k] devant E et I. Comme "orgueil", "écueil".' },
  'écureuil':          { rule: 'CU + EUIL', tip: 'É-cu-reuil : le CU garde le son [k] devant eu. Famille : accueil, orgueil.' },
  'portefeuille':      { rule: 'Composé PORTE + FEUILLE', tip: '"Portefeuille" : un seul mot. "Feuille" vient du latin "folia". Pas de S à feuille.' },
  'grenouille':        { rule: 'Terminaison -OUILLE', tip: '-ouille : grenouille, brouille, rouille, citrouille. Attention au double L : -ille.' },
  'brouillon':         { rule: 'Terminaison -OUILLON', tip: 'Brou-il-lon : double L + -on. Famille : bouillon, tourbillon, vermillon.' },
  'soixante':          { rule: 'X pour le son [s]', tip: '"Soixante" : le X se prononce [s]. Soixante = 60. Soixante-dix = 70. Pas de tiret entre soixante et dix.' },
  'soixante-dix':      { rule: 'Trait d\'union', tip: '70 = soixante-dix avec trait d\'union. 80 = quatre-vingts (avec S). 90 = quatre-vingt-dix (sans S).' },
  'quatre-vingts':     { rule: 'S uniquement à vingt seul', tip: '"Quatre-vingts" prend un S car vingt est seul. Mais "quatre-vingt-dix" sans S car suivi d\'un autre nombre.' },
  'deuxième':          { rule: 'Accent grave sur le E', tip: 'Deux-ième : accent grave sur le premier E. Même logique pour troisième, quatrième...' },
  'rythme':            { rule: 'Y grec + TH', tip: '"Rythme" vient du grec "rhythmos". Le Y remplace le I. Pas de voyelle entre le R et le Y.' },
  'abîme':             { rule: 'Accent circonflexe sur I', tip: '"Abîme" : le î porte un circonflexe, marquant un S disparu (abisme en latin). Comme île, gîte.' },
  'symptôme':          { rule: 'Y grec + accent sur Ô', tip: 'Symp-tô-me : Y grec (vient du grec), et Ô avec accent circonflexe.' },
  'diplôme':           { rule: 'Accent sur le Ô', tip: '"Diplôme" : le Ô porte un accent circonflexe. Même famille : diplômé, diplômer.' },
  'fantôme':           { rule: 'Accent sur le Ô', tip: '"Fantôme" : le Ô avec circonflexe. Vient du grec "phantasma".' },
  'île':               { rule: 'Accent circonflexe sur I', tip: '"Île" : le î marque un S disparu (isle en latin). Même chose pour gîte, abîme.' },
  'château':           { rule: 'Accent sur le A', tip: '"Château" : â avec accent circonflexe (latin "castellum"). Pluriel : châteaux.' },
  'fête':              { rule: 'Accent sur le E', tip: '"Fête" : ê avec circonflexe (latin "festa"). Même famille : fêter, fêtard.' },
  'fenêtre':           { rule: 'Accent sur le E intérieur', tip: '"Fenêtre" : le ê marque un S disparu (fenestre en latin). Même chose pour ancêtre, être.' },
  'forêt':             { rule: 'Accent sur le E + T final muet', tip: '"Forêt" : ê avec circonflexe, T final muet. Pluriel : forêts.' },
  'intérêt':           { rule: 'Deux accents différents', tip: '"Intérêt" : é (aigu) puis ê (circonflexe). Le T final est muet. Même radical que "intéresser".' },
  'connaissance':      { rule: 'Double N + AISS', tip: 'Con-nais-sance : double N, puis le groupe -aiss- (comme naître). Pas "conaissance".' },
  'expression':        { rule: 'X = [ks] + -sion', tip: 'Ex-pres-sion : le X se prononce [ks]. Terminaison -ssion (double S). Famille : exprimer.' },
  'impression':        { rule: 'Double S dans -ssion', tip: 'Im-pres-sion : double S. Famille : imprimer → impression. Comparer : mission, passion.' },
  'attention':         { rule: 'Double T + -tion', tip: 'At-ten-tion : double T (at-), terminaison -tion. Famille : attentif, attentivement.' },
  'exception':         { rule: 'X + -tion (pas -ssion)', tip: 'Ex-cep-tion : attention, pas de double S ici ! -tion simple, comme adoption, option.' },
  'illégal':           { rule: 'Double L au préfixe IL-', tip: 'Devant L, le préfixe "in-" devient "il-" : il-légal, il-lisible, il-logique.' },
  'immense':           { rule: 'Double M au préfixe IM-', tip: 'Devant M, le préfixe "in-" devient "im-" : im-mense, im-meuble, im-migration.' },
  'irréel':            { rule: 'Double R au préfixe IR-', tip: 'Devant R, le préfixe "in-" devient "ir-" : ir-réel, ir-régulier, ir-responsable.' },

  // Avancé
  'chrysanthème':      { rule: 'CH + Y + TH grec', tip: 'Chry-san-thème : CH (son [k]), Y grec, TH grec. Vient du grec "chrysos" (or) + "anthemon" (fleur).' },
  'cacahuète':         { rule: 'Accent grave sur le E', tip: 'Ca-ca-huète : le "hu" se prononce [u], et le E porte un accent grave. Emprunté à l\'espagnol "cacahuete".' },
  'acquérir':          { rule: 'CQU (pas just C)', tip: 'Ac-qué-rir : le groupe CQU est rare mais fixe. Famille : acquis, acquérir, acquisition.' },
  'acquit':            { rule: 'T final muet', tip: '"Quittance" vient de "quit". "Acquit" T final muet. "Pour acquit" : formule de reçu.' },
  'orgueil':           { rule: 'GU + EIL', tip: 'Or-gueil : le U après G garde le son [g] dur devant E. Même logique que "accueil" (CU).' },
  'recueillir':        { rule: 'CU + EILL', tip: 'Re-cueill-ir : le CU préserve le son [k] devant EU. Groupe -eill- + terminaison -ir.' },
  'oignon':            { rule: 'OI + GN', tip: '"Oignon" : le OI se prononce [ɔ̃]. Graphie historique conservée. Nouvelle orthographe admet "ognon".' },
  'clé':               { rule: 'Accent aigu ou E muet ?', tip: '"Clé" s\'écrit avec accent aigu. "Clef" (avec F) est une ancienne orthographe encore acceptée.' },
  'nénuphar':          { rule: 'PH pour le son F', tip: 'Né-nu-phar : le PH (son [f]) vient du persan "nilufar". Pas "nénufar" même si les deux sont acceptés.' },
  'naïf':              { rule: 'Tréma sur le I', tip: '"Naïf" : le tréma sur le I indique que A et I se prononcent séparément [a-i], pas [ɛ] comme dans "mais".' },
  'naïve':             { rule: 'Tréma sur le I', tip: '"Naïve" : même règle. Le tréma sépare les voyelles. Famille : naïvement, naïveté.' },
  'laïque':            { rule: 'Tréma sur le I', tip: '"Laïque" : le ï indique que A et I sont deux syllabes distinctes [la-i-k]. Famille : laïcité.' },
  'coïncidence':       { rule: 'Tréma sur le I', tip: '"Coïncider" : le tréma sur le I sépare CO et IN. [ko-ɛ̃-si-dans], pas [kwɛ̃].' },
  'ambiguë':           { rule: 'Tréma sur le E final', tip: '"Ambiguë" : le tréma sur le E indique que le U se prononce. Sans tréma, "ambigue" lirait le U comme muet.' },
  'Noël':              { rule: 'Tréma sur le E', tip: '"Noël" : le tréma sur E indique que O et E se prononcent séparément [no-ɛl]. Pas [nwɛl].' },
  'maïs':              { rule: 'Tréma sur le I', tip: '"Maïs" : le tréma sépare A et I en deux syllabes [ma-is]. Sans tréma, "mais" = conjonction.' },
  'événement':         { rule: 'Deux accents aigus', tip: 'É-vé-ne-ment : les deux premiers E portent des accents aigus. Pas "évènement" (quoique les deux se disent).' },
  'entraînement':      { rule: 'Accent circonflexe sur Î', tip: 'En-traî-ne-ment : le î porte un circonflexe. Famille : traîner, traîneau, entraîner.' },
  'connaître':         { rule: 'Accent sur le Î devant T', tip: '"Connaître" : le î porte un accent devant T. Règle : le I prend ^ quand il précède un T. Famille : paraître, naître.' },
  'paraître':          { rule: 'Accent sur le Î devant T', tip: '"Paraître" : comme "connaître", le î se marque devant T. Famille : disparaître, réapparaître.' },
  'appât':             { rule: 'Accent circonflexe sur Â', tip: '"Appât" : le â porte un circonflexe. Famille : appâter, appâts. Vient du mot "past" (nourriture).' },
  'châtiment':         { rule: 'Accent sur le Â', tip: '"Châtiment" : â avec circonflexe. Famille : châtier, châtiment. Vient du latin "castigare".' },
  'nonchalance':       { rule: 'Non + chalant', tip: 'Non-cha-lance : préfixe "non" + "chalant" (qui a chaud, qui se soucie). D\'où : indifférence tranquille.' },
  'vraisemblance':     { rule: 'Composé VRAI + SEMBLANT', tip: 'Vrai-sem-blance : "vrai" + "semblant" (paraître). Ce qui semble vrai. Pas "vraisemblence".' },
  'ecchymose':         { rule: 'CC + H grec', tip: 'Ec-chy-mose : double C + CH (son [k]) + Y grec. Vient du grec. Ce mot piège presque tout le monde !' },
  'psychiatre':        { rule: 'PS + Y grec', tip: 'Psy-chiatre : le PS initial est muet ! [p] ne se prononce pas. Vient du grec "psukhê" (âme).' },
  'psychologie':       { rule: 'PS + Y grec muets', tip: 'Psy-cho-logie : le P de PS ne se prononce pas. "Psycho" vient du grec "âme". Famille : psychiatre, psychose.' },
  'rhumatisme':        { rule: 'RH + U initial', tip: 'Rhu-ma-tisme : le RH vient du grec (comme rhume, rhinocéros). Le H rend le R aspiré.' },
  'mnémotechnique':    { rule: 'MN initial (M muet)', tip: 'Mné-mo-technique : le M initial est muet ! Vient du grec "mnêmê" (mémoire). Comme "mnémosyne".' },
  'gaieté':            { rule: 'Deux orthographes', tip: '"Gaieté" ou "gaîté" sont les deux acceptées. "Gaiement" ou "gaîment" aussi. Le circonflexe est optionnel.' },
  'exprès':            { rule: 'Accent grave final', tip: '"Exprès" (adverbe) : accent grave sur le E. À ne pas confondre avec "express" (train rapide, sans accent).' },
  'procès':            { rule: 'Accent grave sur le E final', tip: '"Procès" : è avec accent grave, S final. Même famille : processus (sans accent, sans S final).' },
  'succès':            { rule: 'Double C + accent grave', tip: 'Suc-cès : double C (comme "succinct"), puis accent grave sur le è final.' },
  'palais':            { rule: 'AI + S final muet', tip: '"Palais" : le AI se prononce [ɛ], et le S final est muet. Même famille : balai, essai, délai.' },
};

// ── Liste de mots par niveau ──────────────────────────────────

const SPELLING_WORDS = {
  debutant: [
    'beaucoup','maintenant','quelque chose','aujourd\'hui','toujours','souvent',
    'vraiment','jamais','encore','personne','ensemble','seulement','tellement',
    'longtemps','autrement','facilement','simplement','rapidement','lentement',
    'finalement','heureusement','malheureusement','différemment','certainement',
    'absolument','complètement','exactement','normalement','évidemment',
    'quand même','pourtant','cependant','néanmoins','également','notamment',
    'parfois','quelquefois','dorénavant','désormais','auparavant',
    'bientôt','tantôt','aussitôt','plutôt','surtout','partout','nulle part',
    'quelqu\'un','peut-être','vis-à-vis','c\'est-à-dire','là-bas','là-haut',
    'appeler','jeter','acheter','geler','modeler','amener','emmener','promener',
    'préférer','espérer','céder','gérer','répéter','compléter',
    'maison','famille','enfant','travail','argent','temps','monde',
    'ville','pays','chose','personne','place','corps','main','tête',
    'pied','œil','cœur','sœur','voix','nuit','jour','semaine','mois','année',
    'ami','amie','frère','père','mère','fils','fille',
    'homme','femme','garçon','adulte','jeune','vieux',
    'grand','petit','gros','beau','fort','faible',
    'heureux','triste','content','surpris','inquiet','tranquille',
  ],

  intermediaire: [
    'développement','appartement','gouvernement','environnement','investissement',
    'établissement','renseignement','comportement','changement','traitement',
    'enveloppe','cauchemar','chauffeur','chaussure','chaussée',
    'accueil','écureuil','portefeuille','grenouille','citrouille','rouille',
    'paille','maille','bataille','médaille','muraille','ferraille',
    'brouillon','bouillon','tourbillon','vermillon',
    'appareil','soleil','sommeil','réveil','pareil','conseil',
    'genou','caillou','hibou','chou','bijou','trou','verrou',
    'ennui','bruit','fruit','circuit','produit','réduit',
    'feuille','vieille','groseille','oreille','corbeille','abeille',
    'accorder','accepter','accompagner','affirmer','agrandir',
    'illégal','illimité','illisible','illogique',
    'immense','immeuble','immigration','immédiat','immortel',
    'innombrable','innocent','inutile','irréel','irrégulier','irresponsable',
    'connaissance','reconnaissance',
    'transmission','commission','permission','émission','admission',
    'addition','condition','tradition','position','solution','conclusion',
    'attention','intention','mention','tension','extension','dimension',
    'exception','conception','perception','réception','description','inscription',
    'expression','impression','compression','passion','mission','discussion',
    'soixante','soixante-dix','quatre-vingts','quatre-vingt-dix',
    'deuxième','troisième','quatrième','cinquième','sixième','septième',
    'rythme','abîme','symptôme','diplôme','fantôme',
    'île','château','gâteau','fête','bête','crête','fenêtre','ancêtre',
    'forêt','intérêt','arrêt','prêt',
  ],

  avance: [
    'chrysanthème','cacahuète','mezzanine',
    'exprès','procès','succès','accès','excès',
    'palais','marais','délai','balai','essai','rabais',
    'acquis','requis','acquit','acquérir',
    'orgueil','recueillir',
    'oignon','clé','nénuphar',
    'hôpital','hôtel','hôtesse','honneur','honnête',
    'héros','héroïne','héroïque',
    'hypothèse','hydraulique',
    'ecchymose','psychiatre','psychologie','rhumatisme','mnémotechnique',
    'naïf','naïve','laïque','coïncidence','Noël','maïs',
    'ambiguë',
    'événement','entraînement','connaître','paraître',
    'appât','châtiment',
    'nonchalance','vraisemblance',
    'gaieté','exprès',
    'secrétariat','circonstance',
    'indispensable','incontournable','incompréhensible',
    'irrémédiable','irrécupérable','irréfutable',
  ],
};

// ── Engine ────────────────────────────────────────────────────

const Spelling = {

  queue:        [],
  current:      null,
  sessionDone:  0,
  sessionTotal: 0,
  level:        'debutant',

  start(level) {
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

    // Bouton règle si disponible
    const rule    = SPELLING_RULES[correctWord] || SPELLING_RULES[correctWord.toLowerCase()];
    const ruleBtn = rule
      ? `<button class="spelling-rule-btn" onclick="Spelling.showRule('${correctWord.replace(/'/g, "\\'")}')">? règle</button>`
      : '';

    if (isOk) {
      fb.innerHTML = `
        <div class="spelling-ok-row">
          <div class="spelling-ok">✓ Correct !</div>
          ${ruleBtn}
        </div>`;
      if (inp) inp.disabled = true;
      setTimeout(() => { if (Spelling.current) Spelling._next(); }, 1100);
    } else {
      const typed = inp?.value?.trim() || '';
      fb.innerHTML = `
        <div class="spelling-wrong">✗ Raté</div>
        <div class="spelling-correction">
          <span class="spelling-typed">${escHtml(typed)}</span>
          <span class="spelling-arrow"> → </span>
          <span class="spelling-correct">${escHtml(correctWord)}</span>
          ${ruleBtn}
        </div>`;
      if (inp) inp.disabled = true;
      setTimeout(() => { if (Spelling.current) Spelling._next(); }, 3000);
    }
  },

  // ── Popup règle (style Wordnik) ───────────────────────────

  showRule(word) {
    // Fermer un popup existant
    this.closeRule();

    const rule = SPELLING_RULES[word] || SPELLING_RULES[word.toLowerCase()];
    if (!rule) return;

    const popup = document.createElement('div');
    popup.id        = 'spellingRulePopup';
    popup.className = 'spelling-rule-popup';
    popup.innerHTML = `
      <div class="wl-header">
        <span class="wl-word">${escHtml(word)}</span>
        <button class="wl-close" onclick="Spelling.closeRule()">×</button>
      </div>
      <div class="wl-body">
        <div class="wl-def">
          <span class="wl-pos">${escHtml(rule.rule)}</span>
          <span class="wl-def-text">${escHtml(rule.tip)}</span>
        </div>
        <div class="wl-source">Règle orthographique</div>
      </div>`;

    document.body.appendChild(popup);

    // Positionnement centré sur mobile, ancré sur desktop
    const vw = window.innerWidth;
    if (vw < 600) {
      popup.style.cssText = [
        'position:fixed','top:50%','left:50%',
        'transform:translate(-50%,-50%)',
        'width:' + (vw - 32) + 'px',
        'max-width:400px','z-index:9999',
      ].join(';');
      // Overlay
      const ov = document.createElement('div');
      ov.id = 'spellingRuleOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998';
      ov.addEventListener('click', () => this.closeRule());
      document.body.appendChild(ov);
    } else {
      const btn  = document.querySelector('.spelling-rule-btn');
      const rect = btn ? btn.getBoundingClientRect() : { bottom: 200, left: 100, width: 80 };
      popup.style.cssText = [
        'position:fixed',
        'top:' + (rect.bottom + 8) + 'px',
        'left:' + Math.max(8, rect.left - 120) + 'px',
        'z-index:9999',
        'max-width:320px',
      ].join(';');
    }

    // Fermer sur Escape ou clic extérieur
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

// ── Écran d'accueil ───────────────────────────────────────────

function renderSpelling(forceMenu) {
  const c = document.getElementById('spellingContent');
  if (!c) return;
  if (forceMenu || (!Spelling.current && !Spelling.sessionTotal)) {
    c.innerHTML = `
      <div class="spelling-start">
        <div class="spelling-start-icon">🎧</div>
        <div class="spelling-start-title">Dictée française</div>
        <div class="spelling-start-desc">Écoute le mot et écris-le correctement.<br>Les mots ratés reviennent plus tôt. Un <strong>?</strong> apparaît après chaque mot pour expliquer la règle.</div>
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
      </div>`;
  }
}
