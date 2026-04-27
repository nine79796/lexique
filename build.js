// build.js — Généré automatiquement par Vercel au déploiement.
// Lit la variable d'environnement WORDNIK_API_KEY (définie dans
// Vercel → Settings → Environment Variables) et écrit config.js
// à la racine du projet déployé.
//
// Ce fichier EST commité sur GitHub.
// config.js NE L'EST PAS (.gitignore).

const fs  = require('fs');
const key = process.env.WORDNIK_API_KEY || '';

if (!key) {
  console.warn('[build] ⚠️  WORDNIK_API_KEY non définie — Wordnik désactivé.');
}

const content = `// Généré automatiquement par build.js — NE PAS COMMITER
const __WORDNIK_KEY__ = ${JSON.stringify(key)};
`;

fs.writeFileSync('config.js', content, 'utf8');
console.log('[build] ✅ config.js généré.');
