// Proposal lifecycle for the monthly SEO pipeline.
//
//   proposed -> approved | rejected | deferred
//   approved -> in_progress -> done | scheduled | failed
//
// Pure functions only: the hourly poller reads Slack + the database, calls
// sweep(), and writes the returned changes back. Nothing in here does I/O.

const HOUR = 60 * 60 * 1000;

const REMINDER_AFTER_MS = 24 * HOUR;
const ROLLOVER_AFTER_MS = 48 * HOUR;

const APPROVE_REACTIONS = new Set(['white_check_mark', 'heavy_check_mark']);
const REJECT_REACTIONS = new Set(['x', 'negative_squared_cross_mark']);

// Statuses that mean "Implementation Bot still has work, or you still owe a decision".
// While any item is in one of these, the client report must not be built.
const BLOCKING = new Set(['proposed', 'approved', 'in_progress']);

// An item counts as complete once our part is done: published, sent, or scheduled.
const REPORTABLE = new Set(['done', 'scheduled']);

function decisionFromReactions(reactionNames = []) {
  const approved = reactionNames.some((r) => APPROVE_REACTIONS.has(r));
  const rejected = reactionNames.some((r) => REJECT_REACTIONS.has(r));
  if (approved && rejected) return 'conflict';
  if (approved) return 'approved';
  if (rejected) return 'rejected';
  return null;
}

/**
 * Decide what should change for the current set of proposals.
 *
 * @param items     [{ id, status, postedAt (ms), remindedAt (ms|null) }]
 * @param reactions { [id]: string[] } Slack reaction names currently on each item
 * @param now       ms timestamp
 * @returns { changes: [{id, from, to, reason}], reminders: [id], conflicts: [id] }
 */
function sweep(items, reactions, now) {
  const changes = [];
  const reminders = [];
  const conflicts = [];

  for (const item of items) {
    if (item.status !== 'proposed') continue;

    const decision = decisionFromReactions(reactions[item.id]);
    if (decision === 'conflict') {
      conflicts.push(item.id);
      continue;
    }
    if (decision) {
      changes.push({ id: item.id, from: 'proposed', to: decision, reason: 'slack_reaction' });
      continue;
    }

    const age = now - item.postedAt;
    if (age >= ROLLOVER_AFTER_MS) {
      changes.push({ id: item.id, from: 'proposed', to: 'deferred', reason: 'no_response_48h' });
    } else if (age >= REMINDER_AFTER_MS && !item.remindedAt) {
      reminders.push(item.id);
    }
  }

  return { changes, reminders, conflicts };
}

/** True when nothing is waiting on a decision or on the Implementation Bot. */
function readyForReport(items) {
  return items.length > 0 && items.every((i) => !BLOCKING.has(i.status));
}

/** Deferred items become next month's candidate list (Strategy Bot re-proposes them). */
function rolloverCandidates(items) {
  return items.filter((i) => i.status === 'deferred');
}

module.exports = {
  REMINDER_AFTER_MS,
  ROLLOVER_AFTER_MS,
  BLOCKING,
  REPORTABLE,
  decisionFromReactions,
  sweep,
  readyForReport,
  rolloverCandidates,
};
