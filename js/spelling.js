'use strict';

// ════════════════════════════════════════════════════════════════
//  SPELLING — Système SRS style Anki
//  • Répétition espacée (intervalles en jours)
//  • 3 niveaux obligatoires par jour avec quota dynamique
//  • Interface style AnkiDroid
//  • Tâche Tasks grisée jusqu'au quota atteint
//  • Popup règle style Wordnik
// ════════════════════════════════════════════════════════════════

const LS_KEY_SPELLING     = 'lexique_spelling_srs';
const LS_KEY_SPELLING_SES = 'lexique_spelling_session';

// ── SRS intervals (en jours) ──────────────────────────────────
// Basé sur SM-2 simplifié
// ease: 0=nouveau, 1=difficile, 2=bien, 3=facile
const SRS_INTERVALS = {
  new:   0,   // jamais vu
  again: 1,   // raté  → revoir demain
  hard:  2,   // 2 jours
  good:  4,   // 4 jours
  easy:  7,   // 7 jours
};

// Quota minimum par jour par niveau (ajusté selon performances)
const QUOTA_BASE = { debutant: 10, intermediaire: 8, avance: 6 };

// ── Règles ────────────────────────────────────────────────────

const SPELLING_RULES = {
  'beaucoup':          { rule: 'Un seul mot',              pos: 'Orthographe',    tip: '"Beau" + "coup" soudés. Jamais "beau coup" en deux mots dans ce sens.' },
  "aujourd'hui":       { rule: 'Locution soudée',          pos: 'Orthographe',    tip: 'Contraction de "au jour d\'hui". Toujours en un seul mot avec trait d\'union.' },
  'peut-être':         { rule: 'Trait d\'union obligatoire', pos: 'Ponctuation',  tip: 'Adverbe de doute. À ne pas confondre avec "peut être" (pouvoir + être).' },
  'quand même':        { rule: 'Deux mots sans trait',     pos: 'Orthographe',    tip: 'Contrairement à "néanmoins", "quand même" reste toujours en deux mots.' },
  "c'est-à-dire":      { rule: 'Trois traits d\'union',    pos: 'Ponctuation',    tip: 'Locution figée. Toujours "c\'est-à-dire" avec les deux traits d\'union.' },
  "quelqu'un":         { rule: 'Élision du E',             pos: 'Grammaire',      tip: '"Quelqu\'" avec apostrophe devant "un". Le féminin est "quelqu\'une".' },
  'quelque chose':     { rule: 'Deux mots',                pos: 'Orthographe',    tip: 'Toujours deux mots séparés. "Quelquechose" n\'existe pas.' },
  'nulle part':        { rule: 'Deux mots',                pos: 'Orthographe',    tip: '"Nulle" s\'accorde avec "part" (féminin). Toujours deux mots.' },
  'vis-à-vis':         { rule: 'Locution à traits',        pos: 'Ponctuation',    tip: 'Toujours avec les deux traits d\'union, qu\'il soit préposition ou nom.' },
  'dorénavant':        { rule: 'Un seul mot',              pos: 'Orthographe',    tip: 'Contraction de "dès l\'heure en avant". Pas de trait d\'union.' },
  'désormais':         { rule: 'Accent grave sur E',       pos: 'Accent',         tip: 'Contraction de "dès or mais". Un seul mot.' },
  'évidemment':        { rule: '-emment (pas -ament)',     pos: 'Adverbe',        tip: 'Adjectifs en -ent → adverbe en -emment : évident → évidemment.' },
  'différemment':      { rule: '-emment (pas -ament)',     pos: 'Adverbe',        tip: 'Différent → différemment. Règle : adjectifs en -ent → -emment.' },
  'malheureusement':   { rule: 'Adverbe en -ment',         pos: 'Adverbe',        tip: 'Base : "malheureuse" (féminin) + "-ment".' },
  'heureusement':      { rule: 'Adverbe en -eusement',     pos: 'Adverbe',        tip: 'Base : "heureuse" (féminin de heureux) + "-ment".' },
  'vraiment':          { rule: 'Pas de E avant -ment',     pos: 'Adverbe',        tip: 'Exception : "vrai" + "ment" directement, sans le E du féminin.' },
  'appeler':           { rule: 'Double L conjugué',        pos: 'Conjugaison',    tip: '"Appeler" → j\'appelle, tu appelles. Mais infinitif : appeler.' },
  'jeter':             { rule: 'Double T conjugué',        pos: 'Conjugaison',    tip: '"Jeter" → je jette. Mais pas à l\'infinitif.' },
  'acheter':           { rule: 'Accent grave (pas double T)', pos: 'Conjugaison', tip: '"Acheter" → j\'achète. Contrairement à "jeter" qui double le T.' },
  'préférer':          { rule: 'Deux accents aigus',       pos: 'Accent',         tip: 'Pré-fé-rer : les deux E portent un accent aigu à l\'infinitif.' },
  'œil':               { rule: 'Ligature OE',              pos: 'Typographie',    tip: '"Œ" est une ligature. Le pluriel est "yeux" (forme irrégulière).' },
  'cœur':              { rule: 'Ligature OE',              pos: 'Typographie',    tip: '"Œ" ligature. Jamais "coeur" en français correct.' },
  'sœur':              { rule: 'Ligature OE',              pos: 'Typographie',    tip: '"Sœ" avec ligature, comme cœur et œil.' },
  'développement':     { rule: 'Double P, un seul L',      pos: 'Doublement',     tip: 'Dé-ve-lop-pe-ment : double P mais un seul L.' },
  'appartement':       { rule: 'Double P, double T',       pos: 'Doublement',     tip: 'Ap-par-te-ment : double P et double T. Deux doublets.' },
  'gouvernement':      { rule: 'E intérieur conservé',     pos: 'Orthographe',    tip: 'Gou-ver-ne-ment : le "e" de "gouverne" reste. Pas "gouvernment".' },
  'environnement':     { rule: 'Double N',                 pos: 'Doublement',     tip: 'Envi-ron-ne-ment : double N, comme "donner", "sonner".' },
  'enveloppe':         { rule: 'Double P finale',          pos: 'Doublement',     tip: '"Enveloppe" se termine en -oppe. Comme "nappe", "grappe".' },
  'chauffeur':         { rule: 'AU + FF',                  pos: 'Doublement',     tip: 'Chauf-feur : "au" + double F. Vient de "chauffer".' },
  'cauchemar':         { rule: 'Pas de E final',           pos: 'Orthographe',    tip: '"Cauchemar" sans E final. Vient du flamand "mare".' },
  'accueil':           { rule: 'CU + EIL',                 pos: 'Phonétique',     tip: '"Accueil" : CU préserve le son [k] devant E. Comme "orgueil".' },
  'écureuil':          { rule: 'CU + EUIL',                pos: 'Phonétique',     tip: 'É-cu-reuil : CU garde le son [k] devant eu.' },
  'portefeuille':      { rule: 'Composé soudé',            pos: 'Composé',        tip: '"Portefeuille" : un seul mot. Pas de S à feuille.' },
  'grenouille':        { rule: 'Terminaison -OUILLE',      pos: 'Famille',        tip: '-ouille : grenouille, brouille, rouille, citrouille.' },
  'brouillon':         { rule: '-OUILLON',                  pos: 'Famille',        tip: 'Brou-il-lon : double L + -on. Famille : bouillon, tourbillon.' },
  'soixante':          { rule: 'X pour [s]',               pos: 'Phonétique',     tip: '"Soixante" : le X se prononce [s]. 60 = soixante.' },
  'soixante-dix':      { rule: 'Trait d\'union',           pos: 'Numération',     tip: '70 = soixante-dix. 80 = quatre-vingts (S). 90 = quatre-vingt-dix (sans S).' },
  'quatre-vingts':     { rule: 'S si vingt est seul',      pos: 'Numération',     tip: '"Quatre-vingts" avec S car vingt est seul. "Quatre-vingt-dix" sans S.' },
  'deuxième':          { rule: 'Accent grave sur E',       pos: 'Accent',         tip: 'Deux-ième : accent grave. Même logique pour troisième, quatrième...' },
  'rythme':            { rule: 'Y grec + TH',              pos: 'Étymologie',     tip: '"Rythme" vient du grec "rhythmos". Y remplace le I.' },
  'abîme':             { rule: 'Circonflexe sur Î',        pos: 'Accent',         tip: '"Abîme" : î marque un S disparu (abisme en latin).' },
  'symptôme':          { rule: 'Y grec + Ô',               pos: 'Étymologie',     tip: 'Symp-tô-me : Y grec et Ô avec accent circonflexe.' },
  'diplôme':           { rule: 'Accent sur Ô',             pos: 'Accent',         tip: '"Diplôme" : Ô avec circonflexe. Famille : diplômé, diplômer.' },
  'fantôme':           { rule: 'Accent sur Ô',             pos: 'Accent',         tip: '"Fantôme" : Ô circonflexe. Vient du grec "phantasma".' },
  'île':               { rule: 'Circonflexe sur Î',        pos: 'Accent',         tip: '"Île" : î marque un S disparu (isle en latin).' },
  'château':           { rule: 'Circonflexe sur Â',        pos: 'Accent',         tip: '"Château" : â avec circonflexe. Pluriel : châteaux.' },
  'fête':              { rule: 'Circonflexe sur Ê',        pos: 'Accent',         tip: '"Fête" : ê avec circonflexe (latin "festa").' },
  'fenêtre':           { rule: 'Circonflexe sur Ê',        pos: 'Accent',         tip: '"Fenêtre" : ê marque un S disparu (fenestre en latin).' },
  'forêt':             { rule: 'Ê + T final muet',         pos: 'Accent',         tip: '"Forêt" : ê avec circonflexe, T final muet.' },
  'intérêt':           { rule: 'É puis Ê',                 pos: 'Accent',         tip: '"Intérêt" : é (aigu) puis ê (circonflexe). T final muet.' },
  'connaissance':      { rule: 'Double N + AISS',          pos: 'Doublement',     tip: 'Con-nais-sance : double N, puis -aiss- (comme naître).' },
  'expression':        { rule: 'X + -ssion',               pos: 'Terminaison',    tip: 'Ex-pres-sion : X = [ks], terminaison -ssion (double S).' },
  'impression':        { rule: 'Double S dans -ssion',     pos: 'Terminaison',    tip: 'Im-pres-sion : double S. Famille : imprimer → impression.' },
  'attention':         { rule: 'Double T + -tion',         pos: 'Terminaison',    tip: 'At-ten-tion : double T et terminaison -tion.' },
  'exception':         { rule: '-tion simple',             pos: 'Terminaison',    tip: 'Ex-cep-tion : pas de double S ! -tion simple.' },
  'illégal':           { rule: 'Préfixe IL- (double L)',   pos: 'Préfixe',        tip: 'Devant L, "in-" devient "il-" : il-légal, il-lisible.' },
  'immense':           { rule: 'Préfixe IM- (double M)',   pos: 'Préfixe',        tip: 'Devant M, "in-" devient "im-" : im-mense, im-meuble.' },
  'irréel':            { rule: 'Préfixe IR- (double R)',   pos: 'Préfixe',        tip: 'Devant R, "in-" devient "ir-" : ir-réel, ir-régulier.' },
  'chrysanthème':      { rule: 'CH + Y + TH grec',         pos: 'Étymologie',     tip: 'Chry-san-thème : CH=[k], Y grec, TH grec. Du grec "or + fleur".' },
  'cacahuète':         { rule: 'Accent grave sur E',       pos: 'Emprunt',        tip: 'Ca-ca-huète : E avec accent grave. Emprunté à l\'espagnol.' },
  'acquérir':          { rule: 'Groupe CQU',               pos: 'Phonétique',     tip: 'Ac-qué-rir : CQU est rare mais fixe. Famille : acquis, acquisition.' },
  'orgueil':           { rule: 'GU + EIL',                 pos: 'Phonétique',     tip: 'Or-gueil : U après G garde le son [g] dur devant E.' },
  'recueillir':        { rule: 'CU + EILL',                pos: 'Phonétique',     tip: 'Re-cueill-ir : CU préserve le son [k] devant EU.' },
  'oignon':            { rule: 'OI + GN',                  pos: 'Phonétique',     tip: '"Oignon" : OI se prononce [ɔ̃]. Graphie historique conservée.' },
  'clé':               { rule: 'Accent aigu',              pos: 'Orthographe',    tip: '"Clé" avec accent aigu. "Clef" (avec F) est aussi accepté.' },
  'nénuphar':          { rule: 'PH pour [f]',              pos: 'Étymologie',     tip: 'Né-nu-phar : PH du persan "nilufar".' },
  'naïf':              { rule: 'Tréma sur I',              pos: 'Tréma',          tip: '"Naïf" : tréma indique que A et I se prononcent séparément [a-i].' },
  'naïve':             { rule: 'Tréma sur I',              pos: 'Tréma',          tip: '"Naïve" : même règle. Famille : naïvement, naïveté.' },
  'laïque':            { rule: 'Tréma sur I',              pos: 'Tréma',          tip: '"Laïque" : ï indique deux syllabes distinctes [la-i-k].' },
  'coïncidence':       { rule: 'Tréma sur I',              pos: 'Tréma',          tip: '"Coïncider" : tréma sur I sépare CO et IN.' },
  'ambiguë':           { rule: 'Tréma sur E final',        pos: 'Tréma',          tip: '"Ambiguë" : tréma sur E indique que U se prononce.' },
  'Noël':              { rule: 'Tréma sur E',              pos: 'Tréma',          tip: '"Noël" : tréma sur E → O et E séparés [no-ɛl].' },
  'maïs':              { rule: 'Tréma sur I',              pos: 'Tréma',          tip: '"Maïs" : tréma sépare A et I [ma-is]. Sans tréma = conjonction.' },
  'événement':         { rule: 'Deux accents aigus',       pos: 'Accent',         tip: 'É-vé-ne-ment : les deux premiers E portent des accents aigus.' },
  'entraînement':      { rule: 'Circonflexe sur Î',        pos: 'Accent',         tip: 'En-traî-ne-ment : î avec circonflexe. Famille : traîner, traîneau.' },
  'connaître':         { rule: 'Î devant T',               pos: 'Accent',         tip: '"Connaître" : î prend un accent devant T. Famille : paraître, naître.' },
  'paraître':          { rule: 'Î devant T',               pos: 'Accent',         tip: '"Paraître" : comme "connaître", î se marque devant T.' },
  'appât':             { rule: 'Circonflexe sur Â',        pos: 'Accent',         tip: '"Appât" : â avec circonflexe. Famille : appâter.' },
  'châtiment':         { rule: 'Circonflexe sur Â',        pos: 'Accent',         tip: '"Châtiment" : â avec circonflexe. Famille : châtier.' },
  'nonchalance':       { rule: 'Non + chalant',            pos: 'Étymologie',     tip: '"non" + "chalant" (qui a chaud = qui se soucie). D\'où : indifférence.' },
  'vraisemblance':     { rule: 'Vrai + semblant',          pos: 'Composé',        tip: '"vrai" + "semblant" (paraître). Ce qui semble vrai.' },
  'ecchymose':         { rule: 'CC + H grec',              pos: 'Étymologie',     tip: 'Ec-chy-mose : double C + CH + Y grec. Piège presque tout le monde !' },
  'psychiatre':        { rule: 'PS muet + Y grec',         pos: 'Étymologie',     tip: 'Psy-chiatre : le P de PS ne se prononce pas. Du grec "âme".' },
  'psychologie':       { rule: 'PS muet + Y grec',         pos: 'Étymologie',     tip: 'Psy-cho-logie : P muet. Famille : psychiatre, psychose.' },
  'rhumatisme':        { rule: 'RH initial',               pos: 'Étymologie',     tip: 'Rhu-ma-tisme : RH vient du grec. Comme rhume, rhinocéros.' },
  'mnémotechnique':    { rule: 'MN initial muet',          pos: 'Étymologie',     tip: 'Mné-mo-technique : M initial muet ! Du grec "mnêmê" (mémoire).' },
  'gaieté':            { rule: 'Deux orthographes',        pos: 'Variante',       tip: '"Gaieté" ou "gaîté" sont les deux acceptées.' },
  'exprès':            { rule: 'Accent grave final',       pos: 'Accent',         tip: '"Exprès" (adverbe) : accent grave. ≠ "express" (train rapide).' },
  'procès':            { rule: 'È + S final muet',         pos: 'Accent',         tip: '"Procès" : è avec accent grave, S muet.' },
  'succès':            { rule: 'Double C + È',             pos: 'Doublement',     tip: 'Suc-cès : double C, puis accent grave sur le è final.' },
  'palais':            { rule: 'AI + S muet',              pos: 'Phonétique',     tip: '"Palais" : AI = [ɛ], S final muet. Comme balai, essai.' },
};

// ── Liste de mots ─────────────────────────────────────────────

const SPELLING_WORDS = {
  debutant: [
    'beaucoup','maintenant','quelque chose',"aujourd'hui",'toujours','souvent',
    'vraiment','jamais','encore','personne','ensemble','seulement','tellement',
    'longtemps','autrement','facilement','simplement','rapidement','lentement',
    'finalement','heureusement','malheureusement','différemment','certainement',
    'absolument','complètement','exactement','normalement','évidemment',
    'quand même','pourtant','cependant','néanmoins','également','notamment',
    'parfois','dorénavant','désormais','auparavant','bientôt','plutôt',
    'surtout','partout','nulle part',"quelqu'un",'peut-être','vis-à-vis',
    "c'est-à-dire",'appeler','jeter','acheter','préférer','espérer',
    'maison','famille','enfant','travail','argent','temps','monde',
    'ville','pays','corps','main','tête','pied','œil','cœur','sœur',
    'voix','nuit','jour','semaine','mois','année','ami','amie','frère',
    'père','mère','fils','fille','homme','femme','grand','petit','heureux','triste',
  ],
  intermediaire: [
    'développement','appartement','gouvernement','environnement','investissement',
    'établissement','renseignement','comportement','changement','traitement',
    'enveloppe','cauchemar','chauffeur','chaussure','chaussée',
    'accueil','écureuil','portefeuille','grenouille','citrouille',
    'paille','bataille','médaille','brouillon','bouillon','tourbillon',
    'appareil','soleil','sommeil','réveil','pareil','conseil',
    'genou','caillou','hibou','bijou','trou','verrou',
    'bruit','fruit','circuit','produit','feuille','vieille','groseille','abeille',
    'illégal','illimité','illisible','immense','immeuble','irréel','irrégulier',
    'connaissance','reconnaissance',
    'transmission','commission','permission','émission',
    'addition','condition','tradition','position','solution','conclusion',
    'attention','intention','tension','extension','exception','conception',
    'expression','impression','passion','mission',
    'soixante','soixante-dix','quatre-vingts','quatre-vingt-dix',
    'deuxième','troisième','quatrième','cinquième',
    'rythme','abîme','symptôme','diplôme','fantôme',
    'île','château','gâteau','fête','bête','fenêtre','ancêtre',
    'forêt','intérêt','arrêt','prêt',
  ],
  avance: [
    'chrysanthème','cacahuète','mezzanine',
    'exprès','procès','succès','accès','excès',
    'palais','marais','délai','balai','essai','rabais',
    'acquis','requis','acquit','acquérir',
    'orgueil','recueillir',
    'oignon','clé','nénuphar',
    'hôpital','hôtel','honneur','honnête',
    'héros','héroïne','hypothèse',
    'ecchymose','psychiatre','psychologie','rhumatisme','mnémotechnique',
    'naïf','naïve','laïque','coïncidence','Noël','maïs','ambiguë',
    'événement','entraînement','connaître','paraître',
    'appât','châtiment','nonchalance','vraisemblance','gaieté',
    'secrétariat','circonstance','indispensable','incompréhensible',
    'irrémédiable','irrécupérable',
  ],
};

// ── SRS State ─────────────────────────────────────────────────
// Structure par mot : { interval, dueDate, reps, lapses, lastSeen }

const SpellingSRS = {

  _data: null,

  load() {
    if (this._data) return this._data;
    try {
      const raw = localStorage.getItem(LS_KEY_SPELLING);
      this._data = raw ? JSON.parse(raw) : { cards: {}, today: {} };
      this._data.cards ??= {};
      this._data.today ??= {};
    } catch { this._data = { cards: {}, today: {} }; }
    return this._data;
  },

  save() {
    try { localStorage.setItem(LS_KEY_SPELLING, JSON.stringify(this._data)); } catch {}
  },

  // Initialise une carte si elle n'existe pas
  _card(word, level) {
    const d = this.load();
    const key = level + ':' + word;
    if (!d.cards[key]) {
      d.cards[key] = { interval: 0, dueDate: null, reps: 0, lapses: 0 };
    }
    return d.cards[key];
  },

  // Traite la réponse pour un mot
  answer(word, level, correct) {
    const d    = this.load();
    const key  = level + ':' + word;
    const card = this._card(word, level);
    const today = todayStr();

    // Marquer vu aujourd'hui
    d.today[today] ??= {};
    d.today[today][level] ??= { done: 0, correct: 0 };

    d.today[today][level].done++;
    if (correct) d.today[today][level].correct++;

    if (correct) {
      card.reps++;
      // Intervalle augmente selon les reps
      if (card.reps === 1)      card.interval = SRS_INTERVALS.good;
      else if (card.reps === 2) card.interval = 7;
      else                       card.interval = Math.min(Math.round(card.interval * 1.8), 60);
    } else {
      card.lapses++;
      card.reps     = 0;
      card.interval = SRS_INTERVALS.again;
    }

    card.dueDate = addDays(today, card.interval);
    d.cards[key] = card;
    this.save();
  },

  // Mots dus aujourd'hui pour un niveau
  getDueWords(level) {
    const d     = this.load();
    const today = todayStr();
    const words = SPELLING_WORDS[level];

    return words.filter(word => {
      const key  = level + ':' + word;
      const card = d.cards[key];
      if (!card || !card.dueDate) return true;  // nouveau
      return card.dueDate <= today;              // dû ou en retard
    });
  },

  // Compteurs style Anki pour un niveau
  getCounters(level) {
    const d     = this.load();
    const today = todayStr();
    const words = SPELLING_WORDS[level];
    let newCount = 0, learnCount = 0, reviewCount = 0;

    words.forEach(word => {
      const key  = level + ':' + word;
      const card = d.cards[key];
      if (!card || !card.dueDate) { newCount++; return; }
      if (card.dueDate > today)   return; // pas encore dû
      if (card.reps === 0)        { learnCount++; }
      else                        { reviewCount++; }
    });

    return { new: newCount, learn: learnCount, review: reviewCount };
  },

  // Progrès du jour pour un niveau
  getTodayProgress(level) {
    const d     = this.load();
    const today = todayStr();
    return d.today[today]?.[level] || { done: 0, correct: 0 };
  },

  // Quota du jour pour un niveau (dynamique selon taux de réussite)
  getQuota(level) {
    const d     = this.load();
    const today = todayStr();
    const base  = QUOTA_BASE[level];

    // Calculer le taux de réussite des 7 derniers jours
    let totalDone = 0, totalCorrect = 0;
    for (let i = 1; i <= 7; i++) {
      const day = addDays(today, -i);
      const prog = d.today[day]?.[level];
      if (prog) { totalDone += prog.done; totalCorrect += prog.correct; }
    }

    if (totalDone < 5) return base; // pas assez de données

    const rate = totalCorrect / totalDone;
    if (rate >= 0.85) return Math.max(5,  base - 2); // très bon → moins de mots
    if (rate <= 0.60) return Math.min(15, base + 3); // difficile → plus de mots
    return base;
  },

  // Quota total tous niveaux
  getTotalQuota() {
    return ['debutant','intermediaire','avance'].reduce((a, l) => a + this.getQuota(l), 0);
  },

  // Progrès total du jour (tous niveaux)
  getTotalProgress() {
    const today = todayStr();
    const d = this.load();
    let done = 0;
    ['debutant','intermediaire','avance'].forEach(l => {
      done += d.today[today]?.[l]?.done || 0;
    });
    return done;
  },

  // Est-ce que le quota du jour est atteint ?
  isDailyQuotaMet() {
    return ['debutant','intermediaire','avance'].every(level => {
      const prog  = this.getTodayProgress(level);
      const quota = this.getQuota(level);
      return prog.done >= quota;
    });
  },
};

// ── Session ───────────────────────────────────────────────────

const Spelling = {

  queue:   [],
  current: null,
  level:   null,

  // Timer
  _countdown:      10,
  _countdownTimer: null,
  _timerPaused:    false,

  start(level) {
    this.level = level;
    const due  = SpellingSRS.getDueWords(level);

    if (!due.length) {
      this._showLevelDone(level);
      return;
    }

    // Mélanger + limiter à 20 mots par session
    this.queue = due
      .map(w => ({ label: w, streak: 0 }));
    this._shuffle(this.queue);
    this.queue = this.queue.slice(0, 20);

    this.current = null;
    this._saveSession();
    this._renderUI();
    this._next();
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  },

  _saveSession() {
    try {
      localStorage.setItem(LS_KEY_SPELLING_SES, JSON.stringify({
        level: this.level, queue: this.queue, current: this.current,
      }));
    } catch {}
  },

  _loadSession() {
    try {
      const raw = localStorage.getItem(LS_KEY_SPELLING_SES);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  _clearSession() {
    try { localStorage.removeItem(LS_KEY_SPELLING_SES); } catch {}
  },

  resume(saved) {
    this.level   = saved.level;
    this.queue   = saved.queue;
    this.current = saved.current;
    this._renderUI();
    this._renderWord();
    if (this.current) this._speak(this.current.label);
  },

  _next() {
    if (!this.queue.length) {
      this._clearSession();
      this._showLevelDone(this.level);
      return;
    }
    this.current = this.queue.shift();
    this._saveSession();
    this._renderWord();
    setTimeout(() => this._speak(this.current.label), 150);
  },

  // ── Countdown ──────────────────────────────────────────────

  _startCountdown() {
    this._stopCountdown();
    this._countdown   = 10;
    this._timerPaused = false;
    this._renderCountdown();
    this._countdownTimer = setInterval(() => {
      if (this._timerPaused) return;
      this._countdown--;
      this._renderCountdown();
      if (this._countdown <= 0) { this._stopCountdown(); this._timeUp(); }
    }, 1000);
  },

  _stopCountdown()  { clearInterval(this._countdownTimer); this._countdownTimer = null; },
  _pauseCountdown() { this._timerPaused = true; },
  _resumeCountdown(){ this._timerPaused = false; },

  _renderCountdown() {
    const el  = document.getElementById('spellingCountdown');
    if (!el) return;
    const cls = this._countdown <= 3 ? 'countdown-red'
              : this._countdown <= 6 ? 'countdown-orange'
              : 'countdown-green';
    el.innerHTML = `<div class="spelling-countdown-pill ${cls}">
      <span class="countdown-seconds">${this._countdown}</span><span class="countdown-label">s</span>
    </div>`;
  },

  _timeUp() {
    const inp = document.getElementById('spellingInput');
    if (inp) inp.value = '';
    SpellingSRS.answer(this.current.label, this.level, false);
    this.queue.splice(Math.min(2, this.queue.length), 0, { ...this.current, streak: 0 });
    this._showFeedback(false, this.current.label, true);
    this._updateTaskButton();
  },

  // ── Speech ─────────────────────────────────────────────────

  _speak(word) {
    if (!('speechSynthesis' in window)) { this._startCountdown(); return; }
    window.speechSynthesis.cancel();
    const doSpeak = () => {
      const utt   = new SpeechSynthesisUtterance(word);
      utt.lang    = 'fr-FR';
      utt.rate    = 0.82;
      const btn   = document.getElementById('spellingListenBtn');
      if (btn) btn.classList.add('speaking');
      utt.onend   = () => { if (btn) btn.classList.remove('speaking'); this._startCountdown(); };
      utt.onerror = () => { if (btn) btn.classList.remove('speaking'); this._startCountdown(); };
      const voices  = window.speechSynthesis.getVoices();
      const frVoice = voices.find(v => v.lang === 'fr-FR') || voices.find(v => v.lang.startsWith('fr'));
      if (frVoice) utt.voice = frVoice;
      window.speechSynthesis.speak(utt);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) doSpeak();
    else {
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); };
      setTimeout(() => { if (!window.speechSynthesis.speaking) doSpeak(); }, 800);
    }
  },

  // ── Validate ───────────────────────────────────────────────

  validate() {
    this._stopCountdown();
    const inp    = document.getElementById('spellingInput');
    const answer = (inp?.value || '').trim();
    const correct = this.current?.label;
    if (!answer || !correct) return;

    const norm  = s => s.replace(/'/g, "'").toLowerCase().trim();
    const isOk  = norm(answer) === norm(correct);

    SpellingSRS.answer(correct, this.level, isOk);

    if (isOk) {
      this._showFeedback(true, correct);
      // Mot réussi → ne revient pas dans la session (SRS gère le prochain jour)
    } else {
      this._showFeedback(false, correct);
      // Mot raté → revient dans 2 mots
      this.queue.splice(Math.min(2, this.queue.length), 0, { ...this.current, streak: 0 });
    }
    this._updateTaskButton();
    this._updateProgress();
  },

  // ── UI ─────────────────────────────────────────────────────

  _renderUI() {
    const c = document.getElementById('spellingContent');
    if (!c) return;
    const levelLabel = { debutant: '🟢 Débutant', intermediaire: '🟡 Intermédiaire', avance: '🔴 Avancé' }[this.level];
    c.innerHTML = `
      <div class="spelling-card">
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
          <span id="spellingStatQueue"   class="spelling-stat-queue">${this.queue.length} restants</span>
        </div>
        <div class="spelling-listen-area">
          <button class="spelling-listen-btn" id="spellingListenBtn" onclick="Spelling._replay()">🔊</button>
          <div class="spelling-word-hint" id="spellingWordHint"></div>
          <div class="spelling-hint">Appuie pour réécouter</div>
        </div>
        <div class="spelling-input-row">
          <input type="text" id="spellingInput" class="spelling-input"
            placeholder="Écris le mot…"
            autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"/>
          <button class="btn spelling-validate-btn" onclick="Spelling.validate()">✓</button>
        </div>
        <div class="spelling-feedback" id="spellingFeedback"></div>
        <div class="spelling-actions">
          <button class="btn btn-ghost btn-sm" onclick="Spelling._skip()">Passer →</button>
          <button class="btn btn-ghost btn-sm" onclick="renderSpelling(true)">← Niveaux</button>
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
    if (hint && this.current) hint.textContent = `${this.current.label.length} lettre${this.current.label.length > 1 ? 's' : ''}`;
    this._updateProgress();
  },

  _showFeedback(isOk, correctWord, timeUp = false) {
    const fb  = document.getElementById('spellingFeedback');
    const inp = document.getElementById('spellingInput');
    if (!fb) return;

    const rule    = SPELLING_RULES[correctWord] || SPELLING_RULES[correctWord.toLowerCase()];
    const ruleBtn = rule
      ? `<button class="spelling-rule-btn" onclick="Spelling.showRule('${correctWord.replace(/'/g,"\\'")}')">? règle</button>`
      : '';

    if (isOk) {
      fb.innerHTML = `<div class="spelling-ok-row"><div class="spelling-ok">✓ Correct !</div>${ruleBtn}</div>`;
      if (inp) inp.disabled = true;
      setTimeout(() => { if (Spelling.current) Spelling._next(); }, 1000);
    } else {
      const typed   = inp?.value?.trim() || '';
      const timeMsg = timeUp ? '<span class="spelling-timeup">⏱ Temps écoulé</span>' : '';
      fb.innerHTML = `
        <div class="spelling-wrong-row">${timeMsg}<div class="spelling-wrong">✗ Raté</div></div>
        <div class="spelling-correction">
          ${typed ? `<span class="spelling-typed">${escHtml(typed)}</span><span class="spelling-arrow"> → </span>` : ''}
          <span class="spelling-correct">${escHtml(correctWord)}</span>
          ${ruleBtn}
        </div>`;
      if (inp) inp.disabled = true;
      setTimeout(() => { if (Spelling.current) Spelling._next(); }, 3000);
    }
  },

  _updateProgress() {
    const prog  = SpellingSRS.getTodayProgress(this.level);
    const quota = SpellingSRS.getQuota(this.level);
    const pct   = quota > 0 ? Math.min(100, Math.round(prog.done / quota * 100)) : 0;

    const bar = document.getElementById('spellingProgressBar');
    const sc  = document.getElementById('spellingStatCorrect');
    const st  = document.getElementById('spellingStatTotal');
    const sq  = document.getElementById('spellingStatQueue');
    if (bar) bar.style.width = pct + '%';
    if (sc)  sc.textContent  = prog.correct + ' ✓';
    if (st)  st.textContent  = prog.done + ' / ' + quota;
    if (sq)  sq.textContent  = this.queue.length + ' restants';
  },

  _updateTaskButton() {
    // Griser/activer le bouton valider tâche Spelling dans Tasks
    const met = SpellingSRS.isDailyQuotaMet();
    document.querySelectorAll('[data-spelling-gate]').forEach(btn => {
      btn.disabled = !met;
      btn.classList.toggle('quota-not-met', !met);
    });
  },

  // ── Popup règle style Wordnik ──────────────────────────────

  showRule(word) {
    this.closeRule();
    this._pauseCountdown();

    const rule = SPELLING_RULES[word] || SPELLING_RULES[word.toLowerCase()];
    if (!rule) return;

    const popup = document.createElement('div');
    popup.id        = 'spellingRulePopup';
    popup.className = 'wl-popup spelling-rule-popup-v2';
    popup.innerHTML = `
      <div class="wl-header">
        <span class="wl-word">${escHtml(word)}</span>
        <span class="wl-pronunc">${escHtml(rule.pos)}</span>
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

    // Positionnement
    const vw = window.innerWidth;
    if (vw < 600) {
      popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:${vw-32}px;max-width:400px;z-index:9999`;
      const ov = document.createElement('div');
      ov.id = 'spellingRuleOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998';
      ov.addEventListener('click', () => this.closeRule());
      document.body.appendChild(ov);
    } else {
      const btn  = document.querySelector('.spelling-rule-btn');
      const rect = btn ? btn.getBoundingClientRect() : { bottom: 200, left: 100 };
      popup.style.cssText = `position:fixed;top:${rect.bottom+8}px;left:${Math.max(8,rect.left-120)}px;z-index:9999;max-width:340px`;
    }

    const close = e => {
      if (e.key === 'Escape' || (!popup.contains(e.target) && e.target !== document.querySelector('.spelling-rule-btn'))) {
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
    this._resumeCountdown();
  },

  _replay() {
    if (this.current) { this._stopCountdown(); this._speak(this.current.label); }
  },

  _skip() {
    if (!this.current) return;
    this._stopCountdown();
    window.speechSynthesis.cancel();
    this.queue.push({ ...this.current, streak: 0 });
    this._saveSession();
    this._next();
  },

  _showLevelDone(level) {
    const c     = document.getElementById('spellingContent');
    const prog  = SpellingSRS.getTodayProgress(level);
    const quota = SpellingSRS.getQuota(level);
    const pct   = prog.done > 0 ? Math.round(prog.correct / prog.done * 100) : 0;
    const met   = prog.done >= quota;
    const levelLabel = { debutant: '🟢 Débutant', intermediaire: '🟡 Intermédiaire', avance: '🔴 Avancé' }[level];

    if (!c) return;
    c.innerHTML = `
      <div class="spelling-finished">
        <div class="spelling-finished-icon">${met ? '🎉' : '✅'}</div>
        <div class="spelling-finished-title">${levelLabel} — ${met ? 'Quota atteint !' : 'Session terminée'}</div>
        <div class="spelling-finished-score">${prog.correct} / ${prog.done} — ${pct}%</div>
        <div class="spelling-finished-msg">${pct >= 80 ? '🔥 Excellent !' : pct >= 60 ? '👍 Bien !' : '💪 Continue !'}</div>
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-ghost" onclick="renderSpelling(true)">← Retour aux niveaux</button>
        </div>
      </div>`;
  },
};

// ── Page règles ───────────────────────────────────────────────

function showSpellingRules() {
  const c = document.getElementById('spellingContent');
  if (!c) return;

  const entries = Object.entries(SPELLING_RULES);
  // Grouper par pos
  const byPos = {};
  entries.forEach(([word, r]) => {
    byPos[r.pos] ??= [];
    byPos[r.pos].push([word, r]);
  });

  const sections = Object.entries(byPos).map(([pos, words]) => `
    <div class="srules-section">
      <div class="srules-section-title">${escHtml(pos)}</div>
      ${words.map(([word, r]) => `
        <div class="srules-row">
          <span class="srules-word">${escHtml(word)}</span>
          <div class="srules-right">
            <span class="srules-rule">${escHtml(r.rule)}</span>
            <span class="srules-tip">${escHtml(r.tip)}</span>
          </div>
        </div>`).join('')}
    </div>`).join('');

  c.innerHTML = `
    <div class="spelling-rules-page">
      <div class="spelling-rules-header">
        <span>📖 Toutes les règles (${entries.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="renderSpelling(true)">← Retour</button>
      </div>
      <div class="spelling-rules-search-wrap">
        <input type="text" id="spellingRulesSearch" class="spelling-rules-search"
          placeholder="Chercher un mot ou une règle…"
          autocomplete="off" spellcheck="false"
          oninput="filterSpellingRules(this.value)" />
      </div>
      <div class="spelling-rules-list" id="spellingRulesList">${sections}</div>
    </div>`;
  setTimeout(() => document.getElementById('spellingRulesSearch')?.focus(), 100);
}

// ── Filtre recherche règles ───────────────────────────────────

function filterSpellingRules(query) {
  const list = document.getElementById('spellingRulesList');
  if (!list) return;

  const q = query.trim().toLowerCase();

  if (!q) {
    // Tout afficher
    list.querySelectorAll('.srules-row, .srules-section, .srules-section-title').forEach(el => {
      el.style.display = '';
    });
    return;
  }

  // Filtrer mot par mot
  list.querySelectorAll('.srules-section').forEach(section => {
    let hasVisible = false;
    section.querySelectorAll('.srules-row').forEach(row => {
      const word = row.querySelector('.srules-word')?.textContent?.toLowerCase() || '';
      const rule = row.querySelector('.srules-rule')?.textContent?.toLowerCase() || '';
      const tip  = row.querySelector('.srules-tip')?.textContent?.toLowerCase()  || '';
      const match = word.includes(q) || rule.includes(q) || tip.includes(q);
      row.style.display = match ? '' : 'none';
      if (match) hasVisible = true;
    });
    section.style.display = hasVisible ? '' : 'none';
  });
}

// ── Écran d'accueil style AnkiDroid ──────────────────────────

function renderSpelling(forceMenu) {
  const c = document.getElementById('spellingContent');
  if (!c) return;

  // Reprendre session sauvegardée
  if (!forceMenu) {
    const saved = Spelling._loadSession();
    if (saved?.current) {
      Spelling.resume(saved);
      return;
    }
  }

  const today     = todayStr();
  const totalDone = SpellingSRS.getTotalProgress();
  const totalQuota = SpellingSRS.getTotalQuota();
  const allMet    = SpellingSRS.isDailyQuotaMet();

  const levels = ['debutant', 'intermediaire', 'avance'];
  const levelLabels = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
  const levelColors = { debutant: '#6ec87a', intermediaire: '#c8a96e', avance: '#e87050' };

  const deckRows = levels.map(level => {
    const counters = SpellingSRS.getCounters(level);
    const prog     = SpellingSRS.getTodayProgress(level);
    const quota    = SpellingSRS.getQuota(level);
    const met      = prog.done >= quota;
    const total    = counters.new + counters.learn + counters.review;
    const col      = levelColors[level];

    return `
      <div class="anki-deck-row ${met ? 'deck-done' : ''}" onclick="Spelling.start('${level}')">
        <div class="anki-deck-left">
          <div class="anki-deck-indicator" style="background:${col}"></div>
          <div class="anki-deck-info">
            <span class="anki-deck-name">${levelLabels[level]}</span>
            <span class="anki-deck-sub">${quota} mots / jour · ${prog.done} fait${prog.done > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="anki-deck-counts">
          <span class="anki-count anki-new"  title="Nouveaux">${counters.new}</span>
          <span class="anki-count anki-learn" title="En apprentissage">${counters.learn}</span>
          <span class="anki-count anki-review" title="À réviser">${counters.review}</span>
          ${met ? '<span class="anki-done-check">✓</span>' : ''}
        </div>
      </div>`;
  }).join('');

  // Barre de progrès globale du jour
  const globalPct = totalQuota > 0 ? Math.min(100, Math.round(totalDone / totalQuota * 100)) : 0;

  c.innerHTML = `
    <div class="anki-home">
      <div class="anki-home-header">
        <div class="anki-home-title">Spelling</div>
        <button class="btn btn-ghost btn-sm" onclick="showSpellingRules()">📖 Règles</button>
      </div>

      <div class="anki-global-progress">
        <div class="anki-global-bar-wrap">
          <div class="anki-global-bar" style="width:${globalPct}%"></div>
        </div>
        <div class="anki-global-label">
          <span>${totalDone} / ${totalQuota} mots aujourd'hui</span>
          <span>${globalPct}%</span>
        </div>
      </div>

      <div class="anki-deck-list">
        <div class="anki-deck-header">
          <span>Niveau</span>
          <div class="anki-count-labels">
            <span style="color:#6eb4ff">Nvx</span>
            <span style="color:#e87050">App</span>
            <span style="color:#6ec87a">Rev</span>
          </div>
        </div>
        ${deckRows}
      </div>

      ${allMet ? `
        <div class="anki-all-done">
          🎉 Quota du jour atteint ! Reviens demain.
        </div>` : ''}
    </div>`;
}
