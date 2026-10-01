const pad = (n) => String(n).padStart(2, '0');

// Timestamp -> value for <input type="datetime-local">
export function toLocalInput(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Timestamp -> short label like "Today 5:00 PM"
export function formatDue(ts, now) {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((new Date(ts).setHours(0, 0, 0, 0) - startToday.getTime()) / 86400000);
  let label;
  if (dayDiff === 0) label = 'Today ' + time;
  else if (dayDiff === 1) label = 'Tomorrow ' + time;
  else if (dayDiff === -1) label = 'Yesterday ' + time;
  else label = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
  return { label, overdue: ts < now };
}
