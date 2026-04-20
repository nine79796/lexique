# Lexique — Correctifs & nettoyage

## sw.js — Listener `activate` dupliqué
**Problème :** Deux `self.addEventListener('activate', ...)` coexistaient. Le second (ajouté en bas du fichier pour notifier les clients) était un doublon de l'événement déjà géré dans le premier.
**Correction :** Fusion des deux listeners en un seul bloc cohérent qui purge les anciens caches, appelle `self.clients.claim()` **puis** notifie les clients — dans le bon ordre.

---

## i18n.js — Clés mortes `tasks_filter.*`
**Problème :** Le bloc FR/EN/ES contenait un second jeu de clés `tasks_filter.all`, `tasks_filter.today`, etc., jamais utilisées dans le code. `tasks.js` utilise exclusivement les clés `tasks.filter_*`.
**Correction :** Suppression complète des clés `tasks_filter.*` dans les trois langues.

## i18n.js — Texte du bouton thème codé en dur en français
**Problème :** `applyTranslations()` se terminait par :
```js
document.getElementById('themeBtn').textContent = isLight ? '🌙 Sombre' : '☀️ Clair';
```
Quelle que soit la langue active, le bouton affichait toujours du français.
**Correction :** Ajout des clés `theme.dark` / `theme.light` dans les trois langues (FR/EN/ES) et remplacement de la ligne codée en dur par `t('theme.dark')` / `t('theme.light')`.

## i18n.js — Nettoyage général
- Suppression des doublons : `tasks.deadline_auto` était identique à `modal.deadline_hint` → une seule clé conservée.
- Alignement de l'indentation pour faciliter les diffs futurs.

---

## utils.js — Alias `fmtDay` masquait la fonction `ts()`
**Problème :** L'alias de commodité était défini ainsi :
```js
const fmtDay = ts => DateUtils.fmtDay(ts);
```
Le paramètre `ts` masquait localement la fonction `ts()` dans la portée englobante, ce qui pouvait provoquer des comportements inattendus si `fmtDay` était appelée dans un contexte où `ts` était redéfini.
**Correction :** Renommage du paramètre en `stamp` dans les trois alias concernés (`fmtDay`, `fmtShort`, `fmtFull`).

---

## state.js — `migrate()` sauvegardait inutilement à chaque démarrage
**Problème :** `migrate()` appelait `save()` en fin d'exécution même si aucune donnée n'avait changé, déclenchant un push cloud inutile à chaque chargement de l'app.
**Correction :** Introduction d'un booléen `changed` ; `save()` n'est appelé que si au moins un champ a été modifié ou initialisé.

---

## tasks.js — `updateTaskStats()` : comptage erroné des tâches "en retard"
**Problème :** Pour les tâches récurrentes, la logique comptait comme "en retard" toutes les occurrences actives aujourd'hui non encore terminées :
```js
return isTaskActiveOnDate(task, today) && task.history[today] !== 'done';
```
Cela marquait comme "en retard" des tâches simplement **en attente** pour la journée en cours.
**Correction :** Une tâche récurrente n'est "en retard" que si elle possède des entrées `'missed'` dans son historique (jours passés) :
```js
return Object.entries(task.history || {}).some(([d, v]) => d < today && v === 'missed');
```

## tasks.js — `buildTaskItems()` : `isLate` incorrect pour aujourd'hui
**Problème :** `isLate: !done && d <= today` incluait le jour courant (`d === today`) dans le calcul du retard pour les récurrentes.
**Correction :** `isLate: !done && d < today` (strict inférieur).

## tasks.js — `task.updatedAt` non mis à jour dans les mutations
**Problème :** `toggleTaskDone()`, `autoReportTasks()` et `saveTaskFromModal()` ne mettaient pas à jour le champ `updatedAt`, ce qui faussait la résolution de conflits lors du pull Firestore (qui compare `updatedAt`).
**Correction :** Ajout de `task.updatedAt = ts()` dans chacune de ces fonctions.

---

## firebase.js — Champ `note` vs `desc` dans le push des tâches
**Problème :** Le push Firestore écrivait `task.note ?? ''` mais le modèle de données de `tasks.js` (création, édition, lecture) utilise `task.desc`. Résultat : la description de la tâche était toujours vide dans Firestore (et donc perdue lors du pull depuis un autre appareil).
**Correction :** Alignement sur `task.desc` dans le payload du push.

## firebase.js — Commentaire de sécurité
Ajout d'une note expliquant que la clé API Firebase est publique par nature (côté client) mais que les règles Firestore doivent restreindre l'accès par UID. Rappel de ne jamais inclure de clé Admin SDK dans ce fichier.

---

## notifications.js — Corps des notifications codés en dur en français
**Problème :** Les chaînes de corps des notifications (`"3 occurrences !"`, `"3 clics déjà."`, etc.) étaient hardcodées en français, ignorant la langue active.
**Correction :** Utilisation de `t()` avec des clés dédiées pour les corps de messages. Les clés fallback assurent la compatibilité si les traductions ne sont pas encore définies pour une langue.
