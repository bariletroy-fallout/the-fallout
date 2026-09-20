import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://thefalloutpetition.space';
const OUT = path.resolve('dist');
const seen = new Set();

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

function localPath(url) {
  const u = new URL(url);
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  if (p.endsWith('/')) p += 'index.html';
  return path.join(OUT, p.replace(/^\/+/, ''));
}

function candidates(text, baseUrl, contentType) {
  const out = new Set();
  const patterns = [];
  if (contentType.includes('text/html')) {
    patterns.push(/(?:src|href)=["']([^"'#]+)["']/g);
  }
  if (contentType.includes('text/css')) {
    patterns.push(/url\((?:["']?)([^)"']+)(?:["']?)\)/g);
  }
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const raw = m[1].trim();
      if (!raw || raw.startsWith('data:') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;
      try {
        const u = new URL(raw, baseUrl);
        if (u.origin === ORIGIN) {
          u.hash = '';
          out.add(u.href);
        }
      } catch {}
    }
  }
  return [...out];
}

async function crawl(url) {
  if (seen.has(url)) return;
  seen.add(url);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.log('skip', res.status, url);
    return;
  }
  const type = res.headers.get('content-type') || '';
  const file = localPath(url);
  await fs.mkdir(path.dirname(file), { recursive: true });

  if (type.includes('text/html') || type.includes('text/css') || type.includes('javascript') || type.includes('application/json') || type.includes('image/svg+xml')) {
    let text = await res.text();
    if (new URL(url).pathname === '/' || new URL(url).pathname === '/index.html') {
      const replacements = [
        [
          'Your email stays private and is used to prevent duplicate signatures. It will not be displayed on the site.',
          'Your email stays private. It is checked for a working mail domain and converted to a one-way hash to prevent duplicate signatures. It is never displayed on the site.'
        ],
        [
          'Signing does not subscribe you to a newsletter. Your email is never shown publicly. If you later want your signature removed, use the private question form with the same email address.',
          'Signing does not subscribe you to a newsletter. Your email is never shown publicly. Signatures are screened with duplicate-email hashing, mail-domain checks, bot checks, rate limits, and privacy-preserving network and browser hashes. If you later want your signature removed, use the private question form with the same email address.'
        ],
        [
          'No. Your email is kept out of the public signature list and is used to stop duplicate signatures.',
          'No. Your email is kept out of the public signature list. The petition stores a one-way hash to stop duplicate signatures and checks whether the email domain has a working mail server.'
        ]
      ];
      for (const [from, to] of replacements) {
        if (!text.includes(from)) console.log('replacement source not found:', from.slice(0, 70));
        text = text.split(from).join(to);
      }
    }
    if (new URL(url).pathname === '/privacy.html') {
      text = text
        .split('used to prevent duplicate signatures')
        .join('used for duplicate prevention and integrity screening');
    }
    await fs.writeFile(file, text);
    for (const next of candidates(text, url, type)) await crawl(next);
  } else {
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(file, buf);
  }
}

await crawl(`${ORIGIN}/`);
for (const p of ['/privacy.html', '/index-static.html']) {
  try { await crawl(`${ORIGIN}${p}`); } catch (e) { console.log('optional page skipped', p, String(e)); }
}

const countRes = await fetch('https://gmhnszkfbazsfvcorejt.supabase.co/functions/v1/petition-api/count');
console.log('petition API count status:', countRes.status, await countRes.text());
console.log('mirrored files:', seen.size);
