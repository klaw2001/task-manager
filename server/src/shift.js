import { config } from './config.js';

export const ADMIN_ROLES = ['super_admin', 'training_admin'];

function minutesInZone(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return get('hour') * 60 + get('minute');
}

const toMinutes = (t) => {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
};

/** True when `now` falls inside [start, end). Handles overnight shifts (e.g. 22:00-06:00). */
export function isWithinShift(start, end, now = new Date(), timeZone = config.timezone) {
  if (!start || !end) return true;
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return true;
  const n = minutesInZone(now, timeZone);
  return s < e ? n >= s && n < e : n >= s || n < e;
}

/** Shift state for a user row. Admin roles are never restricted. */
export function shiftInfo(user, now = new Date(), timeZone = config.timezone) {
  const restricted = !ADMIN_ROLES.includes(user.role) && Boolean(user.shift_start && user.shift_end);
  return {
    restricted,
    open: restricted ? isWithinShift(user.shift_start, user.shift_end, now, timeZone) : true,
    start: restricted ? user.shift_start.slice(0, 5) : null,
    end: restricted ? user.shift_end.slice(0, 5) : null,
    timezone: timeZone,
  };
}
