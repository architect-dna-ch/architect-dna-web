// Reads a Google Calendar "secret iCal address" server-side (no CORS, link stays private) and
// returns the next ~2 weeks of events as JSON for the magic-mirror page. The secret URL lives in
// the GOOGLE_ICS_URL environment variable (never sent to the browser). Multiple calendars: set
// GOOGLE_ICS_URL to several URLs separated by commas.
import ical from 'node-ical';

const HORIZON_DAYS = 16;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const raw = process.env.GOOGLE_ICS_URL;
  if (!raw) return res.status(200).json({ events: [], error: 'no_calendar' });

  const urls = raw.split(',').map(s => s.trim()).filter(Boolean);
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400000);
  const windowStart = new Date(now.getTime() - 12 * 3600000); // keep events that started earlier today

  const out = [];
  try {
    for (const url of urls) {
      let data;
      try { data = await ical.async.fromURL(url); }
      catch (e) { continue; } // one bad calendar shouldn't kill the rest
      for (const k in data) {
        const ev = data[k];
        if (!ev || ev.type !== 'VEVENT') continue;
        const durMs = (ev.end && ev.start) ? (ev.end - ev.start) : 3600000;
        const allDay = ev.datetype === 'date' || (ev.start && ev.start.dateOnly === true);

        if (ev.rrule) {
          let dates = [];
          try { dates = ev.rrule.between(windowStart, horizon, true); } catch (e) {}
          const ex = ev.exdate || {};
          for (const d of dates) {
            const key = d.toISOString().slice(0, 10);
            if (ex[key] || ex[d.toISOString()]) continue; // skip cancelled occurrences
            let start = d;
            // node-ical hands recurrence dates back at the original event's clock time but in the
            // server's zone; nudge by the DST difference so weekly events keep their real time.
            if (!allDay && ev.start && ev.rrule.origOptions && ev.rrule.origOptions.tzid) {
              const base = ev.start.getTimezoneOffset();
              const occ = d.getTimezoneOffset();
              if (base !== occ) start = new Date(d.getTime() + (occ - base) * 60000);
            }
            out.push(mk(ev, start, new Date(start.getTime() + durMs), allDay));
          }
        } else {
          const endsAfterNow = (ev.end || ev.start) >= windowStart;
          const startsBeforeHorizon = ev.start <= horizon;
          if (endsAfterNow && startsBeforeHorizon) out.push(mk(ev, ev.start, ev.end || new Date(ev.start.getTime() + durMs), allDay));
        }
      }
    }
  } catch (e) {
    return res.status(200).json({ events: [], error: String((e && e.message) || e) });
  }

  out.sort((a, b) => new Date(a.start) - new Date(b.start));
  res.status(200).json({ events: out.slice(0, 60), at: now.toISOString() });
};

function mk(ev, start, end, allDay) {
  return {
    title: (ev.summary || '').toString().slice(0, 120) || '(ohne Titel)',
    location: (ev.location || '').toString().slice(0, 80),
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    allDay: !!allDay,
  };
}
