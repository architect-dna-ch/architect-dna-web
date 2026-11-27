import { list, put } from '@vercel/blob';
import crypto from 'node:crypto';

// ARC Pulse — a live icebreaker game for parties. Everyone at the event scans a QR code and joins
// with a first name; every few minutes the same mission reaches small groups, who find each other by
// the colour and symbol glowing on their screens.
//
// Nothing here is ever overwritten (an overwritten blob can be served stale): an event is one meta
// file, and every join, "done" and pause is a file of its own. The state is one list() of the event's
// prefix, and the groups are computed the same way on every phone from that list — no shared mutable
// state, so no lost updates. GET is CDN-cached for a few seconds so a full room polls cheaply.
//
//   pulse/<event>/meta.json                      name, start, round length
//   pulse/<event>/p/<joinedAt>_<pid>_<name>.json a participant (first name only)
//   pulse/<event>/d/<round>_<pid>.json           "done" for a round
//   pulse/<event>/x/<at>_<pid>_<on>.json         pause on/off (newest per person wins)

const ROUND_MS = 10 * 60_000;
const clip = (s, n) => String(s || '').replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, n);
const idOk = s => /^[a-z0-9]{6,16}$/.test(String(s || ''));
const hits = new Map();
function rate(ip, n, ms) {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < ms);
  if (a.length >= n) return false;
  a.push(now); hits.set(ip, a); return true;
}
const putJson = (path, obj) => put(path, JSON.stringify(obj), { access: 'public', addRandomSuffix: false, contentType: 'application/json' });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';

  try {
    if (req.method === 'GET') {
      const e = String(req.query.e || '');
      if (!idOk(e)) return res.status(400).json({ error: 'bad event' });
      const blobs = [];
      let cursor;
      do {
        const r = await list({ prefix: `pulse/${e}/`, limit: 1000, cursor });
        blobs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      const meta = blobs.find(b => b.pathname.endsWith('/meta.json'));
      if (!meta) return res.status(404).json({ error: 'no such event' });
      const m = await (await fetch(meta.url, { cache: 'no-store' })).json();
      const people = [], done = {}, pause = {};
      for (const b of blobs) {
        const name = b.pathname.slice(`pulse/${e}/`.length);
        let x;
        if ((x = name.match(/^p\/(\d+)_([a-z0-9]{8})_(.*)\.json$/))) people.push({ at: +x[1], pid: x[2], name: decodeURIComponent(x[3]) });
        else if ((x = name.match(/^d\/(\d+)_([a-z0-9]{8})\.json$/))) (done[x[1]] = done[x[1]] || []).push(x[2]);
        else if ((x = name.match(/^x\/(\d+)_([a-z0-9]{8})_([01])\.json$/))) {
          if (!pause[x[2]] || pause[x[2]].at < +x[1]) pause[x[2]] = { at: +x[1], on: x[3] === '1' };
        }
      }
      people.sort((a, b) => a.at - b.at);
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=4, stale-while-revalidate=4');
      return res.status(200).json({
        now: Date.now(), event: { id: e, name: m.name, start: m.start, roundMs: m.roundMs || ROUND_MS },
        people, paused: Object.keys(pause).filter(k => pause[k].on), done,
      });
    }

    if (req.method !== 'POST') return res.status(405).end();
    res.setHeader('Cache-Control', 'no-store');
    const b = req.body || {};

    if (b.action === 'create') {
      if (!rate(ip, 10, 3_600_000)) return res.status(429).json({ error: 'too many' });
      const id = crypto.randomBytes(5).toString('hex').slice(0, 8);
      const name = clip(b.name, 60) || 'Party';
      const minutes = Math.max(3, Math.min(30, Math.round(+b.minutes) || 10));
      const start = Date.now();
      await putJson(`pulse/${id}/meta.json`, { name, start, roundMs: minutes * 60_000 });
      return res.status(200).json({ ok: true, id, start });
    }

    const e = String(b.e || '');
    if (!idOk(e)) return res.status(400).json({ error: 'bad event' });

    if (b.action === 'join') {
      if (!rate(ip, 30, 3_600_000)) return res.status(429).json({ error: 'too many' });
      const name = clip(b.name, 20);
      if (!name) return res.status(400).json({ error: 'name' });
      const pid = crypto.randomBytes(4).toString('hex');
      const at = Date.now();
      await putJson(`pulse/${e}/p/${at}_${pid}_${encodeURIComponent(name)}.json`, {});
      return res.status(200).json({ ok: true, pid, at });
    }

    const pid = String(b.pid || '');
    if (!/^[a-z0-9]{8}$/.test(pid)) return res.status(400).json({ error: 'bad player' });
    if (!rate(ip, 240, 3_600_000)) return res.status(429).json({ error: 'too many' });

    if (b.action === 'done') {
      const r = Math.max(0, Math.min(999, Math.floor(+b.r) || 0));
      try { await putJson(`pulse/${e}/d/${r}_${pid}.json`, {}); } catch (err) { /* already marked */ }
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'pause') {
      await putJson(`pulse/${e}/x/${Date.now()}_${pid}_${b.on ? 1 : 0}.json`, {});
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'bad action' });
  } catch (err) {
    return res.status(500).json({ error: 'storage error' });
  }
}
