'use strict';

// ════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════════════

const NotificationService = {
  canNotify() {
    return 'Notification' in window && Notification.permission === 'granted';
  },

  send(type, payload) {
    if (!this.canNotify()) return;

    const map = {
      anki:        [t('notif.anki_title'),        `"${payload}" — 3 occurrences !`],
      max:         [t('notif.max_title'),         `"${payload}" : 3 clics déjà.`],
      tasks_today: [t('notif.tasks_today_title'), `${payload} tâche(s) aujourd'hui.`],
      tasks_late:  [t('notif.tasks_late_title'),  `${payload} manquée(s).`],
      recur_due:   [t('notif.recur_title'),       `"${payload}"`],
    };

    const [title, body] = map[type] || ['Lexique', String(payload)];
    new Notification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png' });
  },

  async requestPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      document.getElementById('notifBanner').classList.remove('show');
      this.scheduleDaily(); // Planifie à 9h, ne tire pas immédiatement
    }
  },

  schedule() {
    if (!this.canNotify()) return;

    const today   = todayStr();
    const LS_KEY  = 'lexique_notif_sent';

    // Charge le registre des notifications déjà envoyées ce jour
    let sent = {};
    try { sent = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { sent = {}; }

    // Purge les entrées d'un autre jour pour éviter une croissance infinie
    if (sent._date !== today) sent = { _date: today };

    const due = state.tasks.filter(task =>
      isTaskActiveOnDate(task, today) && getTaskOccurrence(task, today) !== 'done' && !task.done
    );
    const late = state.tasks.reduce((acc, task) => {
      if (task.recurType !== 'once') {
        return acc + Object.entries(task.history || {})
          .filter(([d, v]) => d < today && v === 'missed').length;
      }
      return acc + (!task.done && task.dueDate < today ? 1 : 0);
    }, 0);

    // Envoie chaque type de notification au plus UNE fois par jour
    if (due.length > 0 && !sent['tasks_today']) {
      this.send('tasks_today', due.length);
      sent['tasks_today'] = true;
    }
    if (late > 0 && !sent['tasks_late']) {
      this.send('tasks_late', late);
      sent['tasks_late'] = true;
    }

    try { localStorage.setItem(LS_KEY, JSON.stringify(sent)); } catch { /* quota */ }
  },

  /**
   * Planifie une notification quotidienne à l'heure cible (défaut : 9h00).
   * N'utilise PAS setInterval/setTimeout en boucle : calcule le délai
   * jusqu'au prochain 9h00 et planifie une seule fois.
   * À appeler une seule fois au démarrage après requestPermission.
   */
  scheduleDaily(targetHour = 9) {
    if (!this.canNotify()) return;

    const now      = new Date();
    const next9    = new Date(now);
    next9.setHours(targetHour, 0, 0, 0);

    // Si 9h est déjà passée aujourd'hui, viser demain
    if (next9 <= now) next9.setDate(next9.getDate() + 1);

    const delay = next9.getTime() - now.getTime();

    setTimeout(() => {
      this.schedule();
      // Replanifie pour le lendemain (24h)
      setInterval(() => this.schedule(), 24 * 60 * 60 * 1000);
    }, delay);
  },

  // FIX: méthode checkBanner() manquante — le bloc if était orphelin hors de toute fonction
  checkBanner() {
    if ('Notification' in window && Notification.permission === 'default') {
      document.getElementById('notifBanner').classList.add('show');
    }
  },
};

// Convenience aliases for HTML onclick attributes
const notify                 = (type, payload) => NotificationService.send(type, payload);
const requestNotifPermission = ()              => NotificationService.requestPermission();
const scheduleTaskNotifs     = ()              => NotificationService.schedule();
const checkNotifBanner       = ()              => NotificationService.checkBanner();
