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

// Quota 100% dynamique selon tes performances des 7 derniers jours
// Total entre 20 et 120 mots/jour, réparti selon les taux d'échec par niveau
const QUOTA_TOTAL_MIN     = 20;   // minimum absolu par jour
const QUOTA_TOTAL_DEFAULT = 60;   // valeur si pas assez de données (premiers jours)
const QUOTA_TOTAL_MAX     = 120;  // maximum absolu par jour
const QUOTA_LEVEL_MIN     = 5;    // minimum garanti par niveau même si tu es très fort
const QUOTA_LEVELS        = ['debutant', 'intermediaire', 'avance'];
const QUOTA_BASE          = { debutant: 20, intermediaire: 20, avance: 20 }; // fallback

// Quota exercices — nombre de sessions par exo par jour
// Dynamique : +1 session si taux d'erreur > 50% sur les 3 derniers jours
const EXO_QUOTA_BASE      = 10;  // questions par exo par jour (défaut)
const EXO_QUOTA_MAX       = 30;  // maximum absolu

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
    // Mots courants
    'beaucoup','maintenant','quelque chose',"aujourd'hui",'toujours','souvent',
    'vraiment','jamais','encore','personne','ensemble','seulement','tellement',
    'longtemps','autrement','facilement','simplement','rapidement','lentement',
    'finalement','heureusement','malheureusement','différemment','certainement',
    'absolument','complètement','exactement','normalement','évidemment',
    'quand même','pourtant','cependant','néanmoins','également','notamment',
    'parfois','dorénavant','désormais','auparavant','bientôt','plutôt',
    'surtout','partout','nulle part',"quelqu'un",'peut-être','vis-à-vis',
    "c'est-à-dire",'appeler','jeter','acheter','préférer','espérer',
    // Doubles lettres fréquentes à l'oral
    'balle','belle','ville','fille','mille','grille','aiguille','quille',
    'botte','côtelette','assiette','chaussette','baguette','serviette','tablette',
    'tasse','masse','classe','caisse','boisson','isson','poisson','mousse',
    'adresse','resse','vitesse','tendresse','jeunesse','richesse','paresse',
    'addition','affaire','effet','effort','offrande','offense','officiel',
    'nettoyage','nettoyer','attendre','attraper','attaque','attacher',
    'accorder','accepter','accident','accord','acclamer',
    'correspondre','corriger','corrompre','corridor','correctement',
    'illusion','illuminer','illimité','illégal','illustrer',
    'irriter','irriguer','irréel','irresponsable','irrégulier',
    'immédiat','immeuble','immortel','immense','immigrant',
    'innocent','innombrable','innovation','innover','inné',
    // Mots du quotidien qu'on dit mais qu'on écrit mal
    'maintenant','autrefois','longtemps','pourtant','cependant',
    'souvent','parfois','jamais','toujours','encore',
    'dessus','dessous','dehors','dedans','devant','derrière','autour',
    'environ','alentour','partout','nulle part','quelque part','ailleurs',
    'peut-être','probablement','certainement','sûrement','forcément',
    'franchement','sincèrement','clairement','sérieusement','gentiment',
    'carrément','vachement','vraiment','tellement','tellement',
    'maison','famille','enfant','travail','argent','temps','monde',
    'ville','pays','corps','main','tête','pied','œil','cœur','sœur',
    'voix','nuit','jour','semaine','mois','année','ami','amie','frère',
    'père','mère','fils','fille','homme','femme','grand','petit','heureux','triste',
    // Homophones courants
    'a','à','ou','où','et','est','son','sont','on','ont','ces','ses','mais','mes',
    'leur','leurs','tout','tous','même','mêmes','quelque','quelques',
  ],
  intermediaire: [
    // Doubles lettres — noms et verbes
    'développement','appartement','gouvernement','environnement','investissement',
    'établissement','renseignement','comportement','changement','traitement',
    'enveloppe','cauchemar','chauffeur','chaussure','chaussée',
    'appuyer','approuver','approcher','apprendre','appliquer','apporter',
    'afficher','affirmer','affecter','affranchir','affronter','affilée',
    'effectuer','effacer','efficace','efficacement','effondrer','effectif',
    'officier','offenser','offrir','officiel','officieux',
    'nettement','nettoyage','nettoyer','netteté',
    'sottise','sottement','botter','bottine','bouteille','bouton',
    'attentif','attentivement','atteindre','atteint','attirer','attrait',
    'corriger','correct','correcteur','correction','corridor','correspondre',
    'commencer','commun','communiquer','commander','commande','commercial',
    'permettre','permetions','permis','permanence','permanent',
    'emmener','emmêler','emménager','emmitouflé',
    'souffrir','souffrance','soufflet','soufflé',
    'riffler','griffe','griffonner','griffure',
    'bafouiller','bredouiller','brouillon','bouillir','bouillon',
    // Mots du quotidien oral — doubles lettres cachées
    'boulette','roulette','omelette','galette','tartelette','coquillette',
    'cigarette','maquette','cassette','disquette','pochette','tablette',
    'sonnette','trompette','baguette','fourchette','serviette','chaussette',
    'allumer','aller','allez','allée','allocation','allure','alliance',
    'illusion','illustrer','illustration','illusoire',
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
    // Mots du quotidien oral souvent ratés à l'écrit
    'appartenir','appartient','apparaître','apparence','apparemment',
    'différent','différence','différencier','différemment',
    'occurence','occurrence','occurrent','occasion','occasionnel',
    'agression','agressif','agresseur','agressivité',
    'succession','succéder','successeur','successivement',
    'profession','professionnel','professionnellement',
    'dimension','dimensionnel','immense','immensément',
    'suggestion','suggérer','suggestif','suggestible',
  ],
  avance: [
    'chrysanthème','cacahuète','mezzanine',
    'exprès','procès','succès','accès','excès',
    'palais','marais','délai','balai','essai','rabais',
    'acquis','requis','acquit','acquérir',
    'orgueil','recueillir',
    'oignon','clé','nénuphar',
    'hôpital','hôtel','honneur','honnête','honnêtement',
    'héros','héroïne','hypothèse','hypothétique',
    'ecchymose','psychiatre','psychologie','rhumatisme','mnémotechnique',
    'naïf','naïve','laïque','coïncidence','Noël','maïs','ambiguë',
    'événement','entraînement','connaître','paraître',
    'appât','châtiment','nonchalance','vraisemblance','gaieté',
    'secrétariat','circonstance','indispensable','incompréhensible',
    'irrémédiable','irrécupérable',
    // Doubles lettres piège niveau avancé
    'balancement','ballottement','ballotter','ballottage',
    'effervescence','effervescent','efféminé','effusion',
    'ossification','ossifier','ossature','osseux',
    'assassin','assassinat','assassiner','assaillir','assaisonnement',
    'resserrer','ressembler','ressemblance','ressource','ressortir',
    'dissoudre','dissimuler','dissimulation','dissidence','dissonance',
    'innover','innovation','innombrable','innocuité','innocenter',
    'solliciter','sollicitation','solitude','solliciteur',
    'immobiliser','immobilisme','immobilité','immoler','immodéré',
    'irradier','irrationalité','irréversible','irréfutable','irrépressible',
    'correspondance','correspondant','corrélation','corruption','corroborer',
    'suggestion','suggestif','suggérer','suppléer','suppression',
    // Mots du quotidien oral très souvent ratés
    'vraisemblablement','approximativement','particulièrement','éventuellement',
    'définitivement','provisoirement','successivement','collectivement',
    'intuitivement','instinctivement','progressivement','définitivement',
    'contradictoirement','perpétuellement','éventuellement','fondamentalement',
    'indépendamment','conjointement','parallèlement','manifestement',
    'réciproquement','mutuellement','respectivement','alternativement',
  ],
};

// ── SRS State ─────────────────────────────────────────────────
// Structure par mot : { interval, dueDate, reps, lapses, lastSeen }

// ── Utilitaire TTS français — utilisé par tous les mini-jeux ──
function speakFrench(text, rate = 0.82, onEnd = null) {
  if (!('speechSynthesis' in window)) { if (onEnd) onEnd(); return; }
  window.speechSynthesis.cancel();

  const doSpeak = () => {
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = 'fr-FR';
    utt.rate   = rate;

    // Sélectionner la meilleure voix française disponible
    // Priorité : voix locale fr-FR > voix fr-FR > fr-CA > fr-* > défaut avec lang forcée
    const voices  = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang === 'fr-FR' && v.localService)
                 || voices.find(v => v.lang === 'fr-FR')
                 || voices.find(v => v.lang === 'fr-CA')
                 || voices.find(v => v.lang.startsWith('fr'));
    // Toujours assigner la voix si trouvée, sinon forcer lang sans voix
    // (le navigateur utilisera sa voix fr-FR par défaut si lang est set)
    if (frVoice) {
      utt.voice = frVoice;
    }
    // Lang toujours forcée — même sans voix française trouvée,
    // certains navigateurs mobiles respectent utt.lang pour choisir la voix
    utt.lang = 'fr-FR';

    utt.onend   = () => { if (onEnd) onEnd(); };
    utt.onerror = () => { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utt);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    doSpeak();
  } else {
    // Sur mobile les voix peuvent être chargées en async
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
    // Fallback si onvoiceschanged ne se déclenche pas (Safari iOS)
    setTimeout(() => { if (!window.speechSynthesis.speaking) doSpeak(); }, 500);
  }
}

// ── Mini-timer pour exercices (Vision, Détective, Morpho, Phrase) ──
const MiniTimer = {
  _timer:   null,
  _seconds: 0,
  _onEnd:   null,
  _paused:  false,

  start(seconds, elId, onEnd) {
    this.stop();
    this._seconds = seconds;
    this._onEnd   = onEnd;
    this._paused  = false;
    this._render(elId);
    this._timer = setInterval(() => {
      if (this._paused) return;
      this._seconds--;
      this._render(elId);
      if (this._seconds <= 0) { this.stop(); if (onEnd) onEnd(); }
    }, 1000);
  },

  stop()  { clearInterval(this._timer); this._timer = null; },
  pause() { this._paused = true; },
  resume(){ this._paused = false; },

  _render(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const cls = this._seconds <= 3 ? 'countdown-red'
              : this._seconds <= 6 ? 'countdown-orange' : 'countdown-green';
    el.innerHTML = `<div class="spelling-countdown-pill ${cls}">
      <span class="countdown-seconds">${this._seconds}</span><span class="countdown-label">s</span>
    </div>`;
  },
};

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

    // Marquer vu aujourd'hui — seulement jusqu'au quota
    d.today[today] ??= {};
    d.today[today][level] ??= { done: 0, correct: 0 };

    const quota     = this.getQuota(level);
    const withinQuota = d.today[today][level].done < quota;

    // Ne compter dans le progress que si on est dans le quota du jour
    // Les mots supplémentaires sont quand même entraînés (SRS) mais comptent pour demain
    if (withinQuota) {
      d.today[today][level].done++;
      if (correct) d.today[today][level].correct++;
    } else {
      // Au-delà du quota → reporter au lendemain en mettant dueDate à demain
      // (le SRS sera mis à jour normalement ci-dessous)
    }

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

  /**
   * Calcule le quota dynamique pour un niveau donné.
   *
   * Logique :
   * 1. Calcule le total journalier selon le taux de réussite GLOBAL des 7 derniers jours
   *    - Taux >= 85% (très bon)  → total réduit (moins de révision nécessaire)
   *    - Taux <= 55% (difficile) → total augmenté (plus d'entraînement)
   *    - Entre les deux          → interpolation linéaire
   * 2. Répartit ce total entre les 3 niveaux selon le taux d'ÉCHEC de chaque niveau
   *    - Un niveau avec beaucoup d'échecs reçoit une plus grande part du quota
   *    - Minimum QUOTA_LEVEL_MIN mots garantis par niveau
   */
  getQuota(level) {
    const d     = this.load();
    const today = todayStr();

    // ── Étape 1 : calculer le total dynamique ──────────────────
    let globalDone = 0, globalCorrect = 0;
    for (let i = 1; i <= 7; i++) {
      const day = addDays(today, -i);
      QUOTA_LEVELS.forEach(l => {
        const prog = d.today[day]?.[l];
        if (prog) { globalDone += prog.done; globalCorrect += prog.correct; }
      });
    }

    let totalQuota;
    if (globalDone < 10) {
      // Pas assez de données → valeur par défaut
      totalQuota = QUOTA_TOTAL_DEFAULT;
    } else {
      const rate = globalCorrect / globalDone; // 0.0 → 1.0
      // Interpolation : rate=1.0 → MIN, rate=0.0 → MAX
      totalQuota = Math.round(
        QUOTA_TOTAL_MAX - (QUOTA_TOTAL_MAX - QUOTA_TOTAL_MIN) * rate
      );
      totalQuota = Math.max(QUOTA_TOTAL_MIN, Math.min(QUOTA_TOTAL_MAX, totalQuota));
    }

    // ── Étape 2 : répartir selon les taux d'échec par niveau ───
    // Calculer le taux d'échec de chaque niveau sur 7 jours
    const failRates = {};
    QUOTA_LEVELS.forEach(l => {
      let done = 0, failed = 0;
      for (let i = 1; i <= 7; i++) {
        const prog = d.today[addDays(today, -i)]?.[l];
        if (prog) { done += prog.done; failed += (prog.done - prog.correct); }
      }
      // Si pas de données → taux d'échec moyen de 40% pour répartir équitablement
      failRates[l] = done >= 5 ? (failed / done) : 0.4;
    });

    // Garantir un minimum par niveau puis distribuer le reste proportionnellement
    const reserved = QUOTA_LEVEL_MIN * QUOTA_LEVELS.length;
    const pool     = Math.max(0, totalQuota - reserved);
    const totalFailRate = QUOTA_LEVELS.reduce((s, l) => s + failRates[l], 0);

    const quotas = {};
    QUOTA_LEVELS.forEach(l => {
      const share = totalFailRate > 0 ? failRates[l] / totalFailRate : 1 / QUOTA_LEVELS.length;
      quotas[l]   = QUOTA_LEVEL_MIN + Math.round(pool * share);
    });

    return quotas[level] || QUOTA_LEVEL_MIN;
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

  // Est-ce que le quota du jour est atteint ? (dictée + tous les mini-jeux)
  isDailyQuotaMet() {
    const dicteeOk = ['debutant','intermediaire','avance'].every(level => {
      const prog  = this.getTodayProgress(level);
      const quota = this.getQuota(level);
      return prog.done >= quota;
    });
    const exosOk = this.areExosDone();
    return dicteeOk && exosOk;
  },

  // Marquer un mini-jeu comme complété aujourd'hui
  markExoDone(exoKey) {
    const d     = this.load();
    const today = todayStr();
    d.today[today] ??= {};
    d.today[today]._exos ??= {};
    const prev = d.today[today]._exos[exoKey];
    if (typeof prev === 'number') {
      d.today[today]._exos[exoKey] = prev + 1;
    } else {
      d.today[today]._exos[exoKey] = prev === true ? 2 : 1;
    }
    this.save();
  },

  // Quota de QUESTIONS par exo par jour — dynamique selon taux d'erreur des 3 derniers jours
  getExoQuota(exoKey) {
    const d     = this.load();
    const today = todayStr();
    let totalDone = 0, totalCorrect = 0;
    for (let i = 1; i <= 3; i++) {
      const day = addDays(today, -i);
      ['debutant','intermediaire','avance'].forEach(l => {
        const prog = d.today[day]?.[l];
        if (prog) { totalDone += prog.done; totalCorrect += prog.correct; }
      });
      // Aussi compter les questions de cet exo les jours passés
      const exoProg = d.today[day]?._exos_progress?.[exoKey];
      if (exoProg) { totalDone += exoProg.done; totalCorrect += exoProg.correct; }
    }
    const errorRate = totalDone >= 10 ? 1 - (totalCorrect / totalDone) : 0.5;
    // Plus d'erreurs = plus de pratique nécessaire
    let quota = EXO_QUOTA_BASE;
    if (errorRate > 0.65)      quota = 20;
    else if (errorRate > 0.50) quota = 15;
    else if (errorRate > 0.35) quota = 12;
    else                       quota = 8;  // bon niveau → moins de questions
    return Math.min(EXO_QUOTA_MAX, quota);
  },

  // Enregistre le progrès questions d'un exo
  recordExoAnswer(exoKey, correct) {
    const d     = this.load();
    const today = todayStr();
    d.today[today] ??= {};
    d.today[today]._exos_progress ??= {};
    d.today[today]._exos_progress[exoKey] ??= { done: 0, correct: 0 };
    d.today[today]._exos_progress[exoKey].done++;
    if (correct) d.today[today]._exos_progress[exoKey].correct++;
    this.save();
  },

  // Nombre de questions faites aujourd'hui pour un exo
  getExoDone(exoKey) {
    const d     = this.load();
    const today = todayStr();
    return d.today[today]?._exos_progress?.[exoKey]?.done || 0;
  },

  isExoQuotaMet(exoKey) {
    return this.getExoDone(exoKey) >= this.getExoQuota(exoKey);
  },

  // Rétrocompat — alias
  getExoSessions(exoKey) { return this.getExoDone(exoKey); },

  areExosDone() {
    const d     = this.load();
    const today = todayStr();
    const exos  = d.today[today]?._exos || {};
    return ['vision','detective','morpho','phrase'].every(k => exos[k]);
  },

  getExoProgress() {
    const d     = this.load();
    const today = todayStr();
    return d.today[today]?._exos || {};
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
    const btn = document.getElementById('spellingListenBtn');
    if (btn) btn.classList.add('speaking');
    speakFrench(word, 0.82, () => {
      if (btn) btn.classList.remove('speaking');
      this._startCountdown();
    });
  },

  // ── Validate ───────────────────────────────────────────────

  validate() {
    this._stopCountdown();
    const inp    = document.getElementById('spellingInput');
    const answer = (inp?.value || '').trim();
    const correct = this.current?.label;
    if (!answer || !correct) return;

    // Normalisation : ligatures œ↔oe, æ↔ae, tréma ignoré, apostrophes, casse
    const norm  = s => s
      .replace(/'/g, "'")
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .replace(/ë/g, 'e').replace(/ï/g, 'i').replace(/ü/g, 'u')
      .replace(/ÿ/g, 'y')
      .toLowerCase()
      .trim();
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
      Spelling._nextTimer = setTimeout(() => { if (Spelling.current) Spelling._next(); }, 4500);
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
    this._pauseCountdown(); // ← timer mis en pause pendant la lecture
    MiniTimer.pause();      // ← pause aussi le timer des mini-jeux
    // Annuler le passage à la question suivante pendant la lecture
    clearTimeout(this._nextTimer);
    clearTimeout(Vision?._nextTimer);
    clearTimeout(Detective?._nextTimer);
    clearTimeout(Morpho?._nextTimer);

    const rule = SPELLING_RULES[word] || SPELLING_RULES[word.toLowerCase()];
    if (!rule) {
      // Pas de règle spécifique — affiche quand même un popup basique
      const popup = document.createElement('div');
      popup.id        = 'spellingRulePopup';
      popup.className = 'wl-popup spelling-rule-popup-v2';
      popup.innerHTML = `
        <div class="wl-header">
          <span class="wl-word">${escHtml(word)}</span>
          <button class="wl-close" onclick="Spelling.closeRule()">×</button>
        </div>
        <div class="wl-body">
          <div class="wl-def-text" style="color:var(--text-muted);font-size:13px">
            Aucune règle spécifique disponible pour ce mot.<br>
            Retiens simplement l'orthographe correcte : <strong>${escHtml(word)}</strong>
          </div>
          <div style="margin-top:10px;text-align:center">
            <button class="btn btn-ghost btn-sm" onclick="Spelling.closeRule()">✓ Compris — reprendre</button>
          </div>
        </div>`;
      document.body.appendChild(popup);
      const vw = window.innerWidth;
      if (vw < 600) {
        popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:${vw-32}px;max-width:400px;z-index:9999`;
        const ov = document.createElement('div');
        ov.id = 'spellingRuleOverlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998';
        document.body.appendChild(ov);
      } else {
        const btn  = document.querySelector('.spelling-rule-btn');
        const rect = btn ? btn.getBoundingClientRect() : { bottom: 200, left: 100 };
        popup.style.cssText = `position:fixed;top:${rect.bottom+8}px;left:${Math.max(8,rect.left-120)}px;z-index:9999;max-width:340px`;
      }
      return;
    }

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
        <div style="margin-top:10px;text-align:center">
          <button class="btn btn-ghost btn-sm" onclick="Spelling.closeRule()">✓ Compris — reprendre</button>
        </div>
      </div>`;

    document.body.appendChild(popup);

    // Positionnement
    const vw = window.innerWidth;
    if (vw < 600) {
      popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:${vw-32}px;max-width:400px;z-index:9999`;
      const ov = document.createElement('div');
      ov.id = 'spellingRuleOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998';
      // PAS de fermeture au clic sur l'overlay — l'utilisateur doit lire la règle
      document.body.appendChild(ov);
    } else {
      const btn  = document.querySelector('.spelling-rule-btn');
      const rect = btn ? btn.getBoundingClientRect() : { bottom: 200, left: 100 };
      popup.style.cssText = `position:fixed;top:${rect.bottom+8}px;left:${Math.max(8,rect.left-120)}px;z-index:9999;max-width:340px`;
    }

    // Fermeture uniquement via le bouton "Compris" ou Escape — PAS au clic extérieur
    const close = e => {
      if (e.key === 'Escape') {
        this.closeRule();
        document.removeEventListener('keydown', close);
      }
    };
    setTimeout(() => {
      document.addEventListener('keydown', close);
    }, 0);
  },

  closeRule() {
    document.getElementById('spellingRulePopup')?.remove();
    document.getElementById('spellingRuleOverlay')?.remove();
    this._resumeCountdown(); // ← reprend le timer après lecture
    MiniTimer.resume();      // ← reprend aussi le timer des mini-jeux
    // Reprendre le passage à la question suivante après 1.5s
    const activeGame = typeof Vision !== 'undefined' && Vision._nextTimer === null ? Vision
                     : typeof Detective !== 'undefined' && Detective._nextTimer === null ? Detective
                     : typeof Morpho !== 'undefined' && Morpho._nextTimer === null ? Morpho
                     : null;
    if (activeGame) activeGame._nextTimer = setTimeout(() => activeGame._next(), 1500);
    else this._nextTimer = setTimeout(() => { if (this.current) this._next(); }, 1500);
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

// Met à jour le compteur sessions dans l'en-tête exercices sans tout re-rendre
function _updateExoCounter() {
  const exos = ['vision','detective','morpho','phrase'];
  const totalDone  = exos.reduce((a, k) => a + SpellingSRS.getExoSessions(k), 0);
  const totalQuota = exos.reduce((a, k) => a + SpellingSRS.getExoQuota(k), 0);

  // Header global
  const header = document.getElementById('exoHeaderCounter');
  if (header) header.textContent = `${totalDone}/${totalQuota} sessions`;

  // Chaque ligne
  exos.forEach(key => {
    const sessions = SpellingSRS.getExoSessions(key);
    const quota    = SpellingSRS.getExoQuota(key);
    const met      = SpellingSRS.isExoQuotaMet(key);

    const sub   = document.getElementById(`exoSub-${key}`);
    const check = document.getElementById(`exoCheck-${key}`);
    const row   = document.querySelector(`[data-exo-key="${key}"]`);

    if (sub) {
      // Met à jour uniquement le compteur sessions dans le texte
      sub.textContent = sub.textContent.replace(/\d+\/\d+ sessions?/, `${sessions}/${quota} session${quota > 1 ? 's' : ''}`);
    }
    if (check) check.classList.toggle('visible', met);
    if (row)   row.classList.toggle('deck-done', met);
  });
}

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
          <span class="anki-done-check ${met ? 'visible' : ''}">✓</span>
        </div>
      </div>`;
  }).join('');

  // Exercices supplémentaires — avec quota sessions
  const exoDone = SpellingSRS.getExoProgress();
  const exos = ['vision','detective','morpho','phrase'];
  const _phraseQ  = SpellingSRS.getExoQuota('phrase');
  const _pL       = Math.floor(_phraseQ / 3);
  const _pR       = _phraseQ % 3;
  const phraseDone = SpellingSRS.getExoDone('phrase_debutant')
    + SpellingSRS.getExoDone('phrase_intermediaire')
    + SpellingSRS.getExoDone('phrase_avance');
  const phraseAllMet = SpellingSRS.getExoDone('phrase_debutant') >= _pL
    && SpellingSRS.getExoDone('phrase_intermediaire') >= _pL
    && SpellingSRS.getExoDone('phrase_avance') >= (_pL + _pR);
  const exoTotalDone  = ['vision','detective','morpho'].reduce((a, k) => a + SpellingSRS.getExoSessions(k), 0) + phraseDone;
  const exoTotalQuota = ['vision','detective','morpho'].reduce((a, k) => a + SpellingSRS.getExoQuota(k), 0) + _phraseQ;

  const _exoRow = (key, onclick, color, icon, label, sub) => {
    const sessions = SpellingSRS.getExoSessions(key);
    const quota    = SpellingSRS.getExoQuota(key);
    const met      = SpellingSRS.isExoQuotaMet(key);
    return `
      <div class="anki-deck-row ${met ? 'deck-done' : ''}" data-exo-key="${key}" onclick="${onclick}">
        <div class="anki-deck-left">
          <div class="anki-deck-indicator" style="background:${color}"></div>
          <div class="anki-deck-info">
            <span class="anki-deck-name">${icon} ${label}</span>
            <span class="anki-deck-sub" id="exoSub-${key}">${sub} · ${sessions}/${quota} session${quota > 1 ? 's' : ''}</span>
          </div>
        </div>
        <span class="anki-done-check ${met ? 'visible' : ''}" id="exoCheck-${key}">✓</span>
      </div>`;
  };

  const exoRows = `
    <div class="anki-exo-section">
      <div class="anki-deck-header" style="border-radius:12px 12px 0 0">
        <span>Exercices</span>
        <span id="exoHeaderCounter" style="font-size:11px;color:var(--text-dim)">${exoTotalDone}/${exoTotalQuota} sessions</span>
      </div>
      ${_exoRow('vision',   'Vision.start()',    '#6eb4ff', '👁',  'Vision',    'Choisir la bonne orthographe')}
      ${_exoRow('detective','Detective.start()', '#c8a96e', '🔍', 'Détective', 'Trouver et corriger la faute')}
      ${_exoRow('morpho',   'Morpho.start()',    '#b46ec8', '🧩', 'Morpho',    'Pluriel, accord, conjugaison')}
      <div class="anki-deck-row ${phraseAllMet ? 'deck-done' : ''}" data-exo-key="phrase" onclick="showPhraseLevel()">
        <div class="anki-deck-left">
          <div class="anki-deck-indicator" style="background:#6ec87a"></div>
          <div class="anki-deck-info">
            <span class="anki-deck-name">📝 Phrase</span>
            <span class="anki-deck-sub" id="exoSub-phrase">Dictée de phrase complète · ${phraseDone}/${_phraseQ} questions</span>
          </div>
        </div>
        <span class="anki-done-check ${phraseAllMet ? 'visible' : ''}" id="exoCheck-phrase">✓</span>
      </div>
    </div>`;

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
          <span>Dictée</span>
          <div class="anki-count-labels">
            <span style="color:#6eb4ff">Nvx</span>
            <span style="color:#e87050">App</span>
            <span style="color:#6ec87a">Rev</span>
          </div>
        </div>
        ${deckRows}
      </div>
      ${exoRows}

      ${allMet ? `
        <div class="anki-all-done">
          🎉 Quota du jour atteint ! Reviens demain.
        </div>` : ''}
    </div>`;
}

// ════════════════════════════════════════════════════════════════
//  VISION — Choisir la bonne orthographe parmi 3
// ════════════════════════════════════════════════════════════════

const VISION_DATA = [
  { correct: 'beaucoup',        wrong: ['baucoup','beaucoups'] },
  { correct: 'maintenant',      wrong: ['maintenan','maintanant'] },
  { correct: 'développement',   wrong: ['developpement','développement'] },
  { correct: 'appartement',     wrong: ['apartement','appartment'] },
  { correct: 'cauchemar',       wrong: ['cauchemare','cochemar'] },
  { correct: 'chauffeur',       wrong: ['chaufeur','chauffeut'] },
  { correct: 'accueil',         wrong: ['aceuil','acceuil'] },
  { correct: 'écureuil',        wrong: ['écureul','écureuille'] },
  { correct: 'brouillon',       wrong: ['brouyion','brouiyon'] },
  { correct: 'soixante',        wrong: ['soissante','soixente'] },
  { correct: 'quatrième',       wrong: ['quatrième','quatriéme'] },
  { correct: 'rythme',          wrong: ['rithme','rhythme'] },
  { correct: 'symptôme',        wrong: ['symtome','symptome'] },
  { correct: 'connaissance',    wrong: ['conaissance','connaisance'] },
  { correct: 'expression',      wrong: ['expréssion','expresion'] },
  { correct: 'impression',      wrong: ['inpression','impréssion'] },
  { correct: 'attention',       wrong: ['atention','attenion'] },
  { correct: 'différemment',    wrong: ['différament','diferemment'] },
  { correct: 'évidemment',      wrong: ['éviderment','évidemant'] },
  { correct: 'malheureusement', wrong: ['malheureusment','malhereusement'] },
  { correct: 'absolument',      wrong: ['absolument','absoument'] },
  { correct: 'complètement',    wrong: ['completement','complétement'] },
  { correct: 'immédiatement',   wrong: ['imédiatement','immediatemment'] },
  { correct: 'naturellement',   wrong: ['naturelment','naturellement'] },
  { correct: 'probablement',    wrong: ['probablement','probablement'] },
  { correct: 'exprès',          wrong: ['expres','éxprès'] },
  { correct: 'succès',          wrong: ['succes','succées'] },
  { correct: 'procès',          wrong: ['proces','proccès'] },
  { correct: 'chrysanthème',    wrong: ['chrisantème','chrysanthéme'] },
  { correct: 'cacahuète',       wrong: ['cacahouète','cacahuéte'] },
  { correct: 'psychiatre',      wrong: ['psichiatre','psiquiatre'] },
  { correct: 'ecchymose',       wrong: ['echimose','ecchimose'] },
  { correct: 'vraisemblance',   wrong: ['vraisemblence','vraisemblance'] },
  { correct: 'nonchalance',     wrong: ['nonchalence','nonchallance'] },
  { correct: 'événement',       wrong: ['évènement','événnement'] },
  { correct: 'entraînement',    wrong: ['entrainement','entrainnement'] },
  { correct: 'connaître',       wrong: ['connaitre','conaître'] },
  { correct: 'oignon',          wrong: ['ognon','oïgnon'] },
  { correct: 'naïf',            wrong: ['naif','naïff'] },
  { correct: 'Noël',            wrong: ['Noel','Noëll'] },
  { correct: 'ambiguë',         wrong: ['ambigue','ambigüe'] },
  { correct: 'nettement',       wrong: ['netement','nettament'] },
  { correct: 'carrément',       wrong: ['carément','carèment'] },
  { correct: 'franchement',     wrong: ['franchement','franchment'] },
  { correct: 'baguette',        wrong: ['baguete','baguétte'] },
  { correct: 'serviette',       wrong: ['serviete','serviète'] },
  { correct: 'chaussette',      wrong: ['chausette','chaussète'] },
  { correct: 'allumer',         wrong: ['alumer','allumé'] },
  { correct: 'corriger',        wrong: ['coriger','corriegr'] },
  { correct: 'attendre',        wrong: ['atendre','attendr'] },
  { correct: 'approcher',       wrong: ['aprocher','approchet'] },
  { correct: 'affecter',        wrong: ['afecter','affecté'] },
  { correct: 'ressembler',      wrong: ['resemble','ressemble'] },
  { correct: 'dissoudre',       wrong: ['disoudre','dissoudr'] },
  { correct: 'solliciter',      wrong: ['soliciter','sollicitér'] },
  { correct: 'occurrence',      wrong: ['ocurrence','occurence'] },
  { correct: 'agression',       wrong: ['agréssion','agression'] },
  { correct: 'suggestion',      wrong: ['sugestion','suggesion'] },
];

const Vision = {
  queue:   [],
  current: null,
  done:    0,
  correct: 0,

  start() {
    const quota  = SpellingSRS.getExoQuota('vision');
    this.quota   = quota;
    this.queue   = [...VISION_DATA].sort(() => Math.random() - 0.5).slice(0, quota * 3); // pool large
    this.done    = 0;
    this.correct = 0;
    this.current = null;
    this._renderUI();
    this._next();
  },

  _next() {
    if (this.done >= this.quota || !this.queue.length) { this._showFinished(); return; }
    this.current = this.queue.shift();
    this._renderQuestion();
  },

  _renderUI() {
    const c = document.getElementById('spellingContent');
    if (!c) return;
    const quota = SpellingSRS.getExoQuota('vision');
    c.innerHTML = `
      <div class="spelling-card">
        <div class="spelling-top-bar">
          <div class="spelling-level-badge">👁 Vision</div>
          <div class="spelling-level-badge" id="visionScore">0 / ${quota}</div>
        </div>
        <div class="spelling-progress-wrap">
          <div class="spelling-progress-bar" id="visionProgressBar"></div>
        </div>
        <div id="visionCountdown" style="margin:8px 0;text-align:center"></div>
        <div id="visionQuestion" style="margin-top:8px"></div>
        <div class="spelling-actions" style="margin-top:12px">
          <button class="btn btn-ghost btn-sm" onclick="renderSpelling(true)">← Niveaux</button>
        </div>
      </div>`;
  },

  _renderQuestion() {
    const q   = this.current;
    const all = [q.correct, ...q.wrong].sort(() => Math.random() - 0.5);
    const el  = document.getElementById('visionQuestion');
    if (!el) return;

    el.innerHTML = `
      <div class="vision-prompt">Laquelle est la bonne orthographe ?</div>
      <div class="vision-choices">
        ${all.map(w => `
          <button class="vision-choice" onclick="Vision.pick('${escHtml(w)}')">
            ${escHtml(w)}
          </button>`).join('')}
      </div>
      <div class="vision-feedback" id="visionFeedback"></div>`;

    this._updateScore();
    // Démarrer le timer 10s — timeout = raté
    MiniTimer.start(10, 'visionCountdown', () => {
      document.querySelectorAll('.vision-choice').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent.trim() === this.current.correct) btn.classList.add('vision-ok');
      });
      const fb = document.getElementById('visionFeedback');
      if (fb) fb.innerHTML = `<span class="spelling-wrong">⏱ Temps écoulé — C'était : <strong>${escHtml(this.current.correct)}</strong></span>`;
      this.done++;
      SpellingSRS.recordExoAnswer('vision', false);
      this._updateScore();
      setTimeout(() => this._next(), 2000);
    });
  },

  pick(word) {
    MiniTimer.stop();
    const isOk = word === this.current.correct;
    if (isOk) this.correct++;
    this.done++;
    SpellingSRS.recordExoAnswer('vision', isOk);

    // Colorer les boutons
    document.querySelectorAll('.vision-choice').forEach(btn => {
      btn.disabled = true;
      if (btn.textContent.trim() === this.current.correct) btn.classList.add('vision-ok');
      else if (btn.textContent.trim() === word && !isOk)   btn.classList.add('vision-wrong');
    });

    const fb = document.getElementById('visionFeedback');
    if (fb) fb.innerHTML = isOk
      ? `<span class="spelling-ok">✓ Correct !</span>`
      : `<span class="spelling-wrong">✗ C'était : <strong>${escHtml(this.current.correct)}</strong></span>`;

    this._updateScore();

    const rule = SPELLING_RULES[this.current.correct];
    if (!isOk && rule) {
      // Bouton règle immédiat — pas de délai
      const ruleWord = this.current.correct.replace(/'/g, "\\'");
      if (fb) fb.innerHTML += ` <button class="spelling-rule-btn" onclick="Vision._cancelNext();Spelling.showRule('${ruleWord}')">? règle</button>`;
    }
    // Délai plus long (4s) pour laisser le temps de lire et cliquer sur règle
    this._nextTimer = setTimeout(() => this._next(), isOk ? 900 : 4000);
  },

  _cancelNext() { clearTimeout(this._nextTimer); this._nextTimer = null; },

  _updateScore() {
    const bar = document.getElementById('visionProgressBar');
    const sc  = document.getElementById('visionScore');
    const pct = this.quota > 0 ? Math.round(this.done / this.quota * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    if (sc)  sc.textContent  = this.done + ' / ' + this.quota;
  },

  _showFinished() {
    MiniTimer.stop();
    SpellingSRS.markExoDone('vision');
    // Rafraîchit le compteur de sessions dans la liste
    _updateExoCounter();
    const c        = document.getElementById('spellingContent');
    const pct      = this.done > 0 ? Math.round(this.correct / this.done * 100) : 0;
    const sessions = SpellingSRS.getExoSessions('vision');
    const quota    = SpellingSRS.getExoQuota('vision');
    const quotaMet = SpellingSRS.isExoQuotaMet('vision');
    const quotaHtml = quotaMet
      ? `<div class="exo-quota-met">✅ Quota atteint — ${sessions}/${quota} sessions aujourd'hui</div>`
      : `<div class="exo-quota-progress">Session ${sessions}/${quota} — encore ${quota - sessions} pour aujourd'hui</div>`;
    if (c) c.innerHTML = `
      <div class="spelling-finished">
        <div class="spelling-finished-icon">👁</div>
        <div class="spelling-finished-title">Vision — Terminé !</div>
        <div class="spelling-finished-score">${this.correct} / ${this.done} — ${pct}%</div>
        <div class="spelling-finished-msg">${pct >= 80 ? '🔥 Excellent !' : pct >= 60 ? '👍 Bien !' : '💪 Continue !'}</div>
        ${quotaHtml}
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;justify-content:center">
          <button class="btn" onclick="Vision.start()">Recommencer</button>
          <button class="btn btn-ghost" onclick="renderSpelling(true)">← Niveaux</button>
        </div>
      </div>`;
  },
};


// ════════════════════════════════════════════════════════════════
//  DÉTECTIVE — Trouver et corriger la faute dans une phrase
// ════════════════════════════════════════════════════════════════

const DETECTIVE_DATA = [
  { sentence: 'Il faut faire baucoup attention.', wrong: 'baucoup', correct: 'beaucoup' },
  { sentence: "Aujourd'hui, j'ai mangé une bonne omelète.", wrong: 'omelète', correct: 'omelette' },
  { sentence: 'Elle habite dans un aparement au centre-ville.', wrong: 'aparement', correct: 'appartement' },
  { sentence: 'Le développement de ce projet est trés rapide.', wrong: 'trés', correct: 'très' },
  { sentence: "Je n'ai pas pu dormir à cause d'un cochemar.", wrong: 'cochemar', correct: 'cauchemar' },
  { sentence: 'Le soleil se couche derière les montagnes.', wrong: 'derière', correct: 'derrière' },
  { sentence: "C'est completement faux ce que tu dis.", wrong: 'completement', correct: 'complètement' },
  { sentence: 'Elle chante vraiment bien, sa voice est magnifique.', wrong: 'voice', correct: 'voix' },
  { sentence: 'Il a fait une éffort considérable pour réussir.', wrong: 'éffort', correct: 'effort' },
  { sentence: "L'aceuil dans cet hôtel était parfait.", wrong: 'aceuil', correct: 'accueil' },
  { sentence: 'Mon rêve est de travailler en équipe eficacement.', wrong: 'eficacement', correct: 'efficacement' },
  { sentence: "J'ai une atention particulière pour les détails.", wrong: 'atention', correct: 'attention' },
  { sentence: "Le chauffeur a corrigé sa trajectoire promptement.", wrong: 'promptement', correct: 'promptement' },
  { sentence: "Elle a besoin d'un renforcement de sa conaisance.", wrong: 'conaisance', correct: 'connaissance' },
  { sentence: "Le succés de ce film est incroyable.", wrong: 'succés', correct: 'succès' },
  { sentence: "Il agit toujours avec nonchallance.", wrong: 'nonchallance', correct: 'nonchalance' },
  { sentence: "Ce médicament peut provoquer des echimoses.", wrong: 'echimoses', correct: 'ecchymoses' },
  { sentence: "Elle est naïve mais pas du tout niaise.", wrong: 'niaise', correct: 'niaise' },
  { sentence: "Le quatrieme étage est réservé aux réunions.", wrong: 'quatrieme', correct: 'quatrième' },
  { sentence: "Ce n'est pas un problème, c'est une ocasion.", wrong: 'ocasion', correct: 'occasion' },
  { sentence: "Il faut nettoyer régulièrement pour la propreté.", wrong: 'propreté', correct: 'propreté' },
  { sentence: "Sa performance était vraiment éxceptionnelle.", wrong: 'éxceptionnelle', correct: 'exceptionnelle' },
  { sentence: "Je dois coriger mon devoir avant demain.", wrong: 'coriger', correct: 'corriger' },
  { sentence: "Cet evènement a marqué toute la ville.", wrong: 'evènement', correct: 'événement' },
  { sentence: "Il faut aprendre à gérer ses émotions.", wrong: 'aprendre', correct: 'apprendre' },
  { sentence: "La difference entre les deux est minime.", wrong: 'difference', correct: 'différence' },
  { sentence: "Elle a fait preuve d'une grande genérosité.", wrong: 'genérosité', correct: 'générosité' },
  { sentence: "Son entrainement quotidien porte ses fruits.", wrong: 'entrainement', correct: 'entraînement' },
  { sentence: "La situaton économique est préoccupante.", wrong: 'situaton', correct: 'situation' },
  { sentence: "Il a une perception très développé de l'art.", wrong: 'développé', correct: 'développée' },
];

const Detective = {
  queue:   [],
  current: null,
  done:    0,
  correct: 0,

  start() {
    const quota  = SpellingSRS.getExoQuota('detective');
    this.quota   = quota;
    this.queue   = [...DETECTIVE_DATA].sort(() => Math.random() - 0.5).slice(0, quota * 3);
    this.done    = 0;
    this.correct = 0;
    this.current = null;
    this._renderUI();
    this._next();
  },

  _next() {
    if (this.done >= this.quota || !this.queue.length) { this._showFinished(); return; }
    this.current = this.queue.shift();
    this._renderQuestion();
  },

  _renderUI() {
    const c = document.getElementById('spellingContent');
    if (!c) return;
    c.innerHTML = `
      <div class="spelling-card">
        <div class="spelling-top-bar">
          <div class="spelling-level-badge">🔍 Détective</div>
          <div class="spelling-level-badge" id="detectiveScore">0 / ${SpellingSRS.getExoQuota('detective')}</div>
        </div>
        <div class="spelling-progress-wrap">
          <div class="spelling-progress-bar" id="detectiveProgressBar"></div>
        </div>
        <div id="detectiveCountdown" style="margin:8px 0;text-align:center"></div>
        <div id="detectiveQuestion" style="margin-top:8px"></div>
        <div class="spelling-actions" style="margin-top:12px">
          <button class="btn btn-ghost btn-sm" onclick="renderSpelling(true)">← Niveaux</button>
        </div>
      </div>`;
  },

  _renderQuestion() {
    const q  = this.current;
    const el = document.getElementById('detectiveQuestion');
    if (!el) return;

    el.innerHTML = `
      <div class="detective-prompt">Trouve la faute et corrige-la :</div>
      <div class="detective-sentence">${escHtml(q.sentence)}</div>
      <div class="spelling-input-row" style="margin-top:14px">
        <input type="text" id="detectiveInput" class="spelling-input"
          placeholder="Le mot correct…"
          autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"/>
        <button class="btn spelling-validate-btn" onclick="Detective.validate()">✓</button>
      </div>
      <div class="spelling-feedback" id="detectiveFeedback"></div>`;

    setTimeout(() => {
      const inp = document.getElementById('detectiveInput');
      if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') Detective.validate(); });
      inp?.focus();
    }, 80);

    this._updateScore();
    MiniTimer.start(10, 'detectiveCountdown', () => {
      const inp2 = document.getElementById('detectiveInput');
      if (inp2) inp2.disabled = true;
      const fb = document.getElementById('detectiveFeedback');
      if (fb) fb.innerHTML = `<span class="spelling-wrong">⏱ Temps écoulé — La faute était <strong>${escHtml(this.current.wrong)}</strong> → <strong>${escHtml(this.current.correct)}</strong></span>`;
      this.done++;
      SpellingSRS.recordExoAnswer('detective', false);
      this._updateScore();
      setTimeout(() => this._next(), 2000);
    });
  },

  validate() {
    MiniTimer.stop();
    const inp    = document.getElementById('detectiveInput');
    const norm   = s => s.replace(/'/g,"'").replace(/œ/g,'oe').replace(/æ/g,'ae')
                      .replace(/ë/g,'e').replace(/ï/g,'i').replace(/ü/g,'u').replace(/ÿ/g,'y')
                      .toLowerCase().trim();
    const answer = norm(inp?.value || '');
    const isOk   = answer === norm(this.current.correct);
    this.done++;
    if (isOk) this.correct++;
    SpellingSRS.recordExoAnswer('detective', isOk);

    const fb = document.getElementById('detectiveFeedback');
    if (fb) fb.innerHTML = isOk
      ? `<span class="spelling-ok">✓ Correct !</span>`
      : `<span class="spelling-wrong">✗ La faute était <strong>${escHtml(this.current.wrong)}</strong> → <strong>${escHtml(this.current.correct)}</strong></span>`;

    if (inp) inp.disabled = true;
    this._updateScore();
    this._nextTimer = setTimeout(() => this._next(), isOk ? 900 : 4000);
  },

  _cancelNext() { clearTimeout(this._nextTimer); this._nextTimer = null; },

  _updateScore() {
    const bar = document.getElementById('detectiveProgressBar');
    const sc  = document.getElementById('detectiveScore');
    const pct = this.quota > 0 ? Math.round(this.done / this.quota * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    if (sc)  sc.textContent  = this.done + ' / ' + this.quota;
  },

  _showFinished() {
    MiniTimer.stop();
    SpellingSRS.markExoDone('detective');
    // Rafraîchit le compteur de sessions dans la liste
    _updateExoCounter();
    const c        = document.getElementById('spellingContent');
    const pct      = this.done > 0 ? Math.round(this.correct / this.done * 100) : 0;
    const sessions = SpellingSRS.getExoSessions('detective');
    const quota    = SpellingSRS.getExoQuota('detective');
    const quotaMet = SpellingSRS.isExoQuotaMet('detective');
    const quotaHtml = quotaMet
      ? `<div class="exo-quota-met">✅ Quota atteint — ${sessions}/${quota} sessions aujourd'hui</div>`
      : `<div class="exo-quota-progress">Session ${sessions}/${quota} — encore ${quota - sessions} pour aujourd'hui</div>`;
    if (c) c.innerHTML = `
      <div class="spelling-finished">
        <div class="spelling-finished-icon">🔍</div>
        <div class="spelling-finished-title">Détective — Terminé !</div>
        <div class="spelling-finished-score">${this.correct} / ${this.done} — ${pct}%</div>
        <div class="spelling-finished-msg">${pct >= 80 ? '🔥 Excellent !' : pct >= 60 ? '👍 Bien !' : '💪 Continue !'}</div>
        ${quotaHtml}
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;justify-content:center">
          <button class="btn" onclick="Detective.start()">Recommencer</button>
          <button class="btn btn-ghost" onclick="renderSpelling(true)">← Niveaux</button>
        </div>
      </div>`;
  },
};


// ════════════════════════════════════════════════════════════════
//  MORPHO — Pluriel, accord, conjugaison
// ════════════════════════════════════════════════════════════════

const MORPHO_DATA = [
  // Pluriels irréguliers
  { question: 'Pluriel de : hibou', correct: 'hiboux', hint: 'En -oux' },
  { question: 'Pluriel de : genou', correct: 'genoux', hint: 'En -oux' },
  { question: 'Pluriel de : caillou', correct: 'cailloux', hint: 'En -oux' },
  { question: 'Pluriel de : bijou', correct: 'bijoux', hint: 'En -oux' },
  { question: 'Pluriel de : joujou', correct: 'joujoux', hint: 'En -oux' },
  { question: 'Pluriel de : chou', correct: 'choux', hint: 'En -oux' },
  { question: 'Pluriel de : pou', correct: 'poux', hint: 'En -oux' },
  { question: 'Pluriel de : vitrail', correct: 'vitraux', hint: '-al → -aux' },
  { question: 'Pluriel de : journal', correct: 'journaux', hint: '-al → -aux' },
  { question: 'Pluriel de : animal', correct: 'animaux', hint: '-al → -aux' },
  { question: 'Pluriel de : cheval', correct: 'chevaux', hint: '-al → -aux' },
  { question: 'Pluriel de : travail', correct: 'travaux', hint: '-ail → -aux (irrégulier)' },
  { question: 'Pluriel de : château', correct: 'châteaux', hint: '-eau → -eaux' },
  { question: 'Pluriel de : gâteau', correct: 'gâteaux', hint: '-eau → -eaux' },
  { question: 'Pluriel de : œil', correct: 'yeux', hint: 'Pluriel irrégulier' },
  // Accords
  { question: 'Féminin de : naïf', correct: 'naïve', hint: 'Tréma conservé au féminin' },
  { question: 'Féminin de : doux', correct: 'douce', hint: '-x → -ce au féminin' },
  { question: 'Féminin de : faux', correct: 'fausse', hint: '-x → -sse au féminin' },
  { question: 'Féminin de : vieux', correct: 'vieille', hint: 'Forme irrégulière' },
  { question: 'Féminin de : nouveau', correct: 'nouvelle', hint: 'Forme irrégulière' },
  { question: 'Féminin de : beau', correct: 'belle', hint: 'Forme irrégulière' },
  { question: 'Féminin de : blanc', correct: 'blanche', hint: '-c → -che au féminin' },
  { question: 'Féminin de : sec', correct: 'sèche', hint: '-c → -che + accent au féminin' },
  // Conjugaison
  { question: 'Présent : je (appeler)', correct: "j'appelle", hint: 'Double L au présent' },
  { question: 'Présent : je (jeter)', correct: 'je jette', hint: 'Double T au présent' },
  { question: 'Présent : j\' (acheter)', correct: "j'achète", hint: 'Accent grave au présent' },
  { question: 'Participe passé de : acquérir', correct: 'acquis', hint: 'Participe en -is' },
  { question: 'Participe passé de : naître', correct: 'né', hint: 'Participe court' },
  { question: 'Participe passé de : connaître', correct: 'connu', hint: 'Participe en -u' },
  { question: 'Participe passé de : paraître', correct: 'paru', hint: 'Participe en -u' },
  { question: '80 en lettres', correct: 'quatre-vingts', hint: 'Avec S car vingt est seul' },
  { question: '70 en lettres', correct: 'soixante-dix', hint: 'Avec trait d\'union' },
  { question: '90 en lettres', correct: 'quatre-vingt-dix', hint: 'Sans S car suivi d\'un chiffre' },
];

const Morpho = {
  queue:   [],
  current: null,
  done:    0,
  correct: 0,

  start() {
    const quota  = SpellingSRS.getExoQuota('morpho');
    this.quota   = quota;
    this.queue   = [...MORPHO_DATA].sort(() => Math.random() - 0.5).slice(0, quota * 3);
    this.done    = 0;
    this.correct = 0;
    this.current = null;
    this._renderUI();
    this._next();
  },

  _next() {
    if (this.done >= this.quota || !this.queue.length) { this._showFinished(); return; }
    this.current = this.queue.shift();
    this._renderQuestion();
  },

  _renderUI() {
    const c = document.getElementById('spellingContent');
    if (!c) return;
    c.innerHTML = `
      <div class="spelling-card">
        <div class="spelling-top-bar">
          <div class="spelling-level-badge">🧩 Morpho</div>
          <div class="spelling-level-badge" id="morphoScore">0 / ${SpellingSRS.getExoQuota('morpho')}</div>
        </div>
        <div class="spelling-progress-wrap">
          <div class="spelling-progress-bar" id="morphoProgressBar"></div>
        </div>
        <div id="morphoCountdown" style="margin:8px 0;text-align:center"></div>
        <div id="morphoQuestion" style="margin-top:8px"></div>
        <div class="spelling-actions" style="margin-top:12px">
          <button class="btn btn-ghost btn-sm" onclick="renderSpelling(true)">← Niveaux</button>
        </div>
      </div>`;
  },

  _renderQuestion() {
    const q  = this.current;
    const el = document.getElementById('morphoQuestion');
    if (!el) return;

    el.innerHTML = `
      <div class="detective-prompt">${escHtml(q.question)}</div>
      <div class="spelling-input-row" style="margin-top:14px">
        <input type="text" id="morphoInput" class="spelling-input"
          placeholder="Ta réponse…"
          autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"/>
        <button class="btn spelling-validate-btn" onclick="Morpho.validate()">✓</button>
      </div>
      <div class="spelling-feedback" id="morphoFeedback"></div>`;

    setTimeout(() => {
      const inp = document.getElementById('morphoInput');
      if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') Morpho.validate(); });
      inp?.focus();
    }, 80);

    this._updateScore();
    MiniTimer.start(10, 'morphoCountdown', () => {
      const inp2 = document.getElementById('morphoInput');
      if (inp2) inp2.disabled = true;
      const fb = document.getElementById('morphoFeedback');
      if (fb) fb.innerHTML = `<span class="spelling-wrong">⏱ Temps écoulé — Réponse : <strong>${escHtml(this.current.correct)}</strong></span>
         <div style="font-size:12px;color:var(--text-dim);margin-top:4px">💡 ${escHtml(this.current.hint)}</div>`;
      this.done++;
      SpellingSRS.recordExoAnswer('morpho', false);
      this._updateScore();
      setTimeout(() => this._next(), 2500);
    });
  },

  validate() {
    MiniTimer.stop();
    const inp    = document.getElementById('morphoInput');
    const norm   = s => s.replace(/'/g,"'").replace(/œ/g,'oe').replace(/æ/g,'ae')
                      .replace(/ë/g,'e').replace(/ï/g,'i').replace(/ü/g,'u').replace(/ÿ/g,'y')
                      .toLowerCase().trim();
    const answer = norm(inp?.value || '');
    const isOk   = answer === norm(this.current.correct);
    this.done++;
    if (isOk) this.correct++;
    SpellingSRS.recordExoAnswer('morpho', isOk);

    const fb = document.getElementById('morphoFeedback');
    if (fb) fb.innerHTML = isOk
      ? `<span class="spelling-ok">✓ Correct !</span>`
      : `<span class="spelling-wrong">✗ Réponse : <strong>${escHtml(this.current.correct)}</strong></span>
         <div style="font-size:12px;color:var(--text-dim);margin-top:4px">💡 ${escHtml(this.current.hint)}</div>`;

    if (inp) inp.disabled = true;
    this._updateScore();
    this._nextTimer = setTimeout(() => this._next(), isOk ? 900 : 4000);
  },

  _cancelNext() { clearTimeout(this._nextTimer); this._nextTimer = null; },

  _updateScore() {
    const bar = document.getElementById('morphoProgressBar');
    const sc  = document.getElementById('morphoScore');
    const pct = this.quota > 0 ? Math.round(this.done / this.quota * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    if (sc)  sc.textContent  = this.done + ' / ' + this.quota;
  },

  _showFinished() {
    MiniTimer.stop();
    SpellingSRS.markExoDone('morpho');
    // Rafraîchit le compteur de sessions dans la liste
    _updateExoCounter();
    const c        = document.getElementById('spellingContent');
    const pct      = this.done > 0 ? Math.round(this.correct / this.done * 100) : 0;
    const sessions = SpellingSRS.getExoSessions('morpho');
    const quota    = SpellingSRS.getExoQuota('morpho');
    const quotaMet = SpellingSRS.isExoQuotaMet('morpho');
    const quotaHtml = quotaMet
      ? `<div class="exo-quota-met">✅ Quota atteint — ${sessions}/${quota} sessions aujourd'hui</div>`
      : `<div class="exo-quota-progress">Session ${sessions}/${quota} — encore ${quota - sessions} pour aujourd'hui</div>`;
    if (c) c.innerHTML = `
      <div class="spelling-finished">
        <div class="spelling-finished-icon">🧩</div>
        <div class="spelling-finished-title">Morpho — Terminé !</div>
        <div class="spelling-finished-score">${this.correct} / ${this.done} — ${pct}%</div>
        <div class="spelling-finished-msg">${pct >= 80 ? '🔥 Excellent !' : pct >= 60 ? '👍 Bien !' : '💪 Continue !'}</div>
        ${quotaHtml}
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;justify-content:center">
          <button class="btn" onclick="Morpho.start()">Recommencer</button>
          <button class="btn btn-ghost" onclick="renderSpelling(true)">← Niveaux</button>
        </div>
      </div>`;
  },
};


// ════════════════════════════════════════════════════════════════
//  PHRASE — Dictée de phrase entière (TTS)
// ════════════════════════════════════════════════════════════════

const PHRASE_DATA = [
  // Débutant
  { text: "Il fait beau aujourd'hui.", level: 'debutant' },
  { text: "Ma famille habite dans une grande maison.", level: 'debutant' },
  { text: "J'ai beaucoup de travail ce soir.", level: 'debutant' },
  { text: "Mon frère est vraiment gentil.", level: 'debutant' },
  { text: "Elle parle toujours trop vite.", level: 'debutant' },
  { text: "Le temps passe très rapidement.", level: 'debutant' },
  { text: "Je préfère rester chez moi ce soir.", level: 'debutant' },
  { text: "Nous sommes ensemble depuis longtemps.", level: 'debutant' },
  { text: "Il faut seulement faire attention.", level: 'debutant' },
  { text: "Ma mère prépare un bon repas.", level: 'debutant' },
  // Intermédiaire
  { text: "Le développement de ce projet prend beaucoup de temps.", level: 'intermediaire' },
  { text: "Elle habite dans un appartement au quatrième étage.", level: 'intermediaire' },
  { text: "J'ai eu un cauchemar à cause de l'environnement bruyant.", level: 'intermediaire' },
  { text: "Le chauffeur a attendu patiemment devant l'entrée.", level: 'intermediaire' },
  { text: "L'accueil dans cet établissement est vraiment chaleureux.", level: 'intermediaire' },
  { text: "Il faut faire attention aux fautes d'expression écrite.", level: 'intermediaire' },
  { text: "La reconnaissance de ses efforts l'a profondément ému.", level: 'intermediaire' },
  { text: "Ce médicament agit sur le système immunitaire.", level: 'intermediaire' },
  { text: "Elle s'entraîne soixante-dix minutes chaque matin.", level: 'intermediaire' },
  { text: "Son sommeil s'est amélioré grâce à ce traitement.", level: 'intermediaire' },
  // Avancé
  { text: "L'ecchymose sur son bras témoignait d'une chute violente.", level: 'avance' },
  { text: "Ce psychiatre est reconnu pour ses travaux sur la psychologie cognitive.", level: 'avance' },
  { text: "La vraisemblance de ce récit le rendait particulièrement troublant.", level: 'avance' },
  { text: "Il agissait avec une nonchalance déconcertante face aux événements.", level: 'avance' },
  { text: "La coïncidence de ces deux événements était tout à fait naïve.", level: 'avance' },
  { text: "Pour acquérir cette compétence, il faut s'entraîner quotidiennement.", level: 'avance' },
  { text: "Les chrysanthèmes fleurissent à l'automne dans nos jardins.", level: 'avance' },
  { text: "Son ambiguïté le rendait irrémédiablement incompréhensible.", level: 'avance' },
  { text: "Ce rhumatisme irréversible nécessite un traitement permanent.", level: 'avance' },
  { text: "La mnémotechnique est une technique d'apprentissage très efficace.", level: 'avance' },
];

const Phrase = {
  queue:        [],
  current:      null,
  done:         0,
  correct:      0,
  activeLevel:  'debutant',

  start(level) {
    this.activeLevel = level || 'debutant';
    const totalQuota = SpellingSRS.getExoQuota('phrase');
    const perLevel   = Math.floor(totalQuota / 3);
    const remainder  = totalQuota % 3;
    const levelQuotas = { debutant: perLevel, intermediaire: perLevel, avance: perLevel + remainder };
    this.quota   = levelQuotas[this.activeLevel] || perLevel;
    const filtered = PHRASE_DATA.filter(p => p.level === this.activeLevel);
    this.queue   = [...filtered].sort(() => Math.random() - 0.5).slice(0, this.quota * 3);
    this.done    = 0;
    this.correct = 0;
    this.current = null;
    this._renderUI();
    this._next();
  },

  _next() {
    if (this.done >= this.quota || !this.queue.length) { this._showFinished(); return; }
    this.current = this.queue.shift();
    this._renderQuestion();
    setTimeout(() => this._speak(this.current.text), 200);
  },

  _speak(text) {
    const btn = document.getElementById('phraseListenBtn');
    if (btn) btn.classList.add('speaking');
    speakFrench(text, 0.78, () => {
      if (btn) btn.classList.remove('speaking');
      Phrase._startPhraseTimer();
    });
  },

  _renderUI() {
    const c = document.getElementById('spellingContent');
    if (!c) return;
    const levelLabel = { debutant: '🟢 Débutant', intermediaire: '🟡 Intermédiaire', avance: '🔴 Avancé' }[this.activeLevel];
    c.innerHTML = `
      <div class="spelling-card">
        <div class="spelling-top-bar">
          <div class="spelling-level-badge">📝 Phrase</div>
          <div class="spelling-level-badge">${levelLabel}</div>
        </div>
        <div class="spelling-progress-wrap">
          <div class="spelling-progress-bar" id="phraseProgressBar"></div>
        </div>
        <div class="spelling-stats-row">
          <span id="phraseScore" class="spelling-stat-good">0 ✓</span>
          <span id="phraseTotal" class="spelling-stat-total">0 / ${this.quota}</span>
        </div>
        <div id="phraseQuestion" style="margin-top:16px"></div>
        <div class="spelling-actions" style="margin-top:12px">
          <button class="btn btn-ghost btn-sm" onclick="renderSpelling(true)">← Niveaux</button>
        </div>
      </div>`;
  },

  _renderQuestion() {
    const el = document.getElementById('phraseQuestion');
    if (!el) return;

    el.innerHTML = `
      <div class="phrase-listen-area">
        <button class="spelling-listen-btn" id="phraseListenBtn" onclick="Phrase._speak(Phrase.current.text)">🔊</button>
        <div class="spelling-hint">Écoute et écris la phrase complète</div>
      </div>
      <textarea id="phraseInput" class="phrase-input"
        placeholder="Écris la phrase ici…"
        autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"
        rows="3"></textarea>
      <button class="btn" style="width:100%;margin-top:8px" onclick="Phrase.validate()">Valider ✓</button>
      <div class="spelling-feedback" id="phraseFeedback"></div>`;

    setTimeout(() => document.getElementById('phraseInput')?.focus(), 100);
    this._updateScore();
    // Le timer de 15s démarre après la lecture de la phrase
    // On attend que _speak() appelle son callback onEnd pour démarrer
    // (le timer est lancé depuis _speak via phraseTimerReady)
    Phrase._phraseTimerPending = true;
  },

  _startPhraseTimer() {
    if (!this._phraseTimerPending) return;
    this._phraseTimerPending = false;
    MiniTimer.start(15, 'phraseCountdown', () => {
      const inp2 = document.getElementById('phraseInput');
      if (inp2) inp2.disabled = true;
      const fb = document.getElementById('phraseFeedback');
      if (fb) fb.innerHTML = `<span class="spelling-wrong">⏱ Temps écoulé !</span>`;
      this.done++;
      SpellingSRS.recordExoAnswer('phrase_' + this.activeLevel, false);
      this._updateScore();
      setTimeout(() => this._next(), 2000);
    });
  },

  validate() {
    MiniTimer.stop();
    this._phraseTimerPending = false;
    const inp    = document.getElementById('phraseInput');
    const answer = (inp?.value || '').trim();
    const target = this.current.text;

    // Comparer mot par mot et colorer
    const normWord = w => w.toLowerCase().replace(/[.,!?;:]/g, '').replace(/'/g, "'");
    const aWords   = answer.split(/\s+/);
    const tWords   = target.split(/\s+/);

    let correctWords = 0;
    const highlighted = tWords.map((tw, i) => {
      const aw   = aWords[i] || '';
      const isOk = normWord(aw) === normWord(tw);
      if (isOk) correctWords++;
      return `<span class="phrase-word ${isOk ? 'pw-ok' : 'pw-wrong'}">${escHtml(tw)}</span>`;
    }).join(' ');

    const totalWords = tWords.length;
    const pct        = Math.round(correctWords / totalWords * 100);
    const isOk       = pct >= 90;

    this.done++;
    if (isOk) this.correct++;
    SpellingSRS.recordExoAnswer('phrase_' + this.activeLevel, isOk);

    const fb = document.getElementById('phraseFeedback');
    if (fb) fb.innerHTML = `
      <div style="margin-top:12px">
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px">Correction :</div>
        <div class="phrase-correction">${highlighted}</div>
        <div style="margin-top:8px;font-size:13px;color:${isOk ? '#6ec87a' : '#e87050'}">
          ${correctWords}/${totalWords} mots corrects (${pct}%) — ${isOk ? '✓ Réussi !' : '✗ Raté'}
        </div>
      </div>`;

    if (inp) inp.disabled = true;
    this._updateScore();
    setTimeout(() => this._next(), isOk ? 1500 : 3500);
  },

  _updateScore() {
    const bar = document.getElementById('phraseProgressBar');
    const sc  = document.getElementById('phraseScore');
    const tot = document.getElementById('phraseTotal');
    const pct = this.quota > 0 ? Math.round(this.done / this.quota * 100) : 0;
    if (bar) bar.style.width = pct + '%';
    if (sc)  sc.textContent  = this.correct + ' ✓';
    if (tot) tot.textContent = this.done + ' / ' + this.quota;
  },

  _showFinished() {
    MiniTimer.stop();
    SpellingSRS.markExoDone('phrase');
    // Rafraîchit le compteur de sessions dans la liste
    _updateExoCounter();
    const c        = document.getElementById('spellingContent');
    const pct      = this.done > 0 ? Math.round(this.correct / this.done * 100) : 0;
    const sessions = SpellingSRS.getExoSessions('phrase');
    const quota    = SpellingSRS.getExoQuota('phrase');
    const quotaMet = SpellingSRS.isExoQuotaMet('phrase');
    const quotaHtml = quotaMet
      ? `<div class="exo-quota-met">✅ Quota atteint — ${sessions}/${quota} sessions aujourd'hui</div>`
      : `<div class="exo-quota-progress">Session ${sessions}/${quota} — encore ${quota - sessions} pour aujourd'hui</div>`;
    if (c) c.innerHTML = `
      <div class="spelling-finished">
        <div class="spelling-finished-icon">📝</div>
        <div class="spelling-finished-title">Phrase — Terminé !</div>
        <div class="spelling-finished-score">${this.correct} / ${this.done} — ${pct}%</div>
        <div class="spelling-finished-msg">${pct >= 80 ? '🔥 Excellent !' : pct >= 60 ? '👍 Bien !' : '💪 Continue !'}</div>
        ${quotaHtml}
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;justify-content:center">
          <button class="btn" onclick="Phrase.start('${this.activeLevel}')">Recommencer</button>
          <button class="btn btn-ghost" onclick="renderSpelling(true)">← Niveaux</button>
        </div>
      </div>`;
  },
};

// Sélection du niveau pour Phrase
function showPhraseLevel() {
  const c = document.getElementById('spellingContent');
  if (!c) return;

  const levelColors = { debutant: '#6ec87a', intermediaire: '#c8a96e', avance: '#e87050' };
  const levelLabels = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
  const levelDescs  = {
    debutant:      'Phrases courtes du quotidien',
    intermediaire: 'Phrases avec accords et homophones',
    avance:        'Phrases avec mots pièges',
  };

  // Quota total réparti équitablement sur les 3 niveaux
  const totalQuota   = SpellingSRS.getExoQuota('phrase');
  const perLevel     = Math.floor(totalQuota / 3);
  const remainder    = totalQuota % 3;
  // Le niveau avancé prend le reste si quota pas divisible par 3
  const levelQuotas  = {
    debutant:      perLevel,
    intermediaire: perLevel,
    avance:        perLevel + remainder,
  };

  const deckRows = ['debutant', 'intermediaire', 'avance'].map(level => {
    const col      = levelColors[level];
    const levelQ   = levelQuotas[level];
    const done     = SpellingSRS.getExoDone('phrase_' + level);
    const met      = done >= levelQ;
    return `
      <div class="anki-deck-row ${met ? 'deck-done' : ''}" onclick="Phrase.start('${level}')">
        <div class="anki-deck-left">
          <div class="anki-deck-indicator" style="background:${col}"></div>
          <div class="anki-deck-info">
            <span class="anki-deck-name">${levelLabels[level]}</span>
            <span class="anki-deck-sub">${levelDescs[level]} · ${done}/${levelQ} questions</span>
          </div>
        </div>
        <span class="anki-done-check ${met ? 'visible' : ''}">✓</span>
      </div>`;
  }).join('');

  c.innerHTML = `
    <div class="anki-home">
      <div class="anki-home-header">
        <div class="anki-home-title">📝 Phrase</div>
      </div>
      <div class="anki-deck-list">
        <div class="anki-deck-header">
          <span>Choisir le niveau</span>
          <div class="anki-count-labels">
            <span style="color:#6eb4ff">Phrases</span>
          </div>
        </div>
        ${deckRows}
      </div>
      <div style="margin-top:12px;text-align:center">
        <button class="btn btn-ghost btn-sm" onclick="renderSpelling(true)">← Retour</button>
      </div>
    </div>`;
}
