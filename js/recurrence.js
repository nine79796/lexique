'use strict';

// ════════════════════════════════════════════════════════════════
//  RECURRENCE ENGINE
// ════════════════════════════════════════════════════════════════

const RecurrenceEngine = {
  /**
   * Returns true if the task should occur on the given date string.
   */
  isActiveOnDate(task, dateStr) {
    if (task.recurType === 'once') return task.dueDate === dateStr;

    const start = task.recurStart || task.dueDate || dateStr;
    const end   = task.recurEnd   || null;
    const dl    = task.deadline   || null;

    if (dateStr < start)              return false;
    if (end && dateStr > end)         return false;
    if (dl  && dateStr > dl)          return false;
    if (task.recurType === 'daily')   return true;

    if (task.recurType === 'weekly') {
      return (task.recurDays || []).includes(getDowFromStr(dateStr));
    }

    if (task.recurType === 'interval') {
      const interval = task.recurInterval || 1;
      const diff     = daysBetween(start, dateStr);
      return diff >= 0 && diff % interval === 0;
    }

    return false;
  },

  /**
   * Returns the history value for a given date ('done' | 'missed' | null).
   */
  getOccurrence(task, dateStr) {
    task.history ??= {};
    return task.history[dateStr] || null;
  },

  /**
   * Returns all active dates from the task's start up to `upTo` (inclusive).
   * Capped at 400 iterations to prevent infinite loops on misconfigured tasks.
   */
  getPastDueDates(task, upTo) {
    const today = upTo || todayStr();
    if (task.recurType === 'once') {
      return task.dueDate && task.dueDate <= today ? [task.dueDate] : [];
    }

    const start   = task.recurStart || task.dueDate || today;
    const results = [];
    let cursor    = start;
    let guard     = 0;

    while (cursor <= today && guard < 400) {
      if (this.isActiveOnDate(task, cursor)) results.push(cursor);
      cursor = addDays(cursor, 1);
      guard++;
    }
    return results;
  },

};

// Convenience aliases
const isTaskActiveOnDate = (task, d) => RecurrenceEngine.isActiveOnDate(task, d);
const getTaskOccurrence  = (task, d) => RecurrenceEngine.getOccurrence(task, d);
const getPastDueDates    = (task, d) => RecurrenceEngine.getPastDueDates(task, d);
