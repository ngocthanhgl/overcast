import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

/**
 * AQICN / WAQI proxy. The token lives in the server environment (`AQICN_TOKEN`) and is
 * never sent to the client or echoed in responses.
 *
 * Only the coordinate feed is allowed:
 *   GET /api/aqicn-proxy?path=/feed/geo:21.03;105.85/
 */
const ALLOWED_PATH = /^\/feed\/geo:-?\d+(?:\.\d+)?;-?\d+(?:\.\d+)?\/$/;

export default async function handler(request: any, response: any) {
  const token = process.env.AQICN_TOKEN;
  if (!token) {
    response.status(503).json({ status: 'error', message: 'AQICN not configured' });
    return;
  }

  let path = '';
  try {
    const urlObj = new URL(request.url || '', 'http://localhost');
    path = urlObj.searchParams.get('path') || '';
  } catch {
    response.status(400).json({ status: 'error', message: 'Bad request' });
    return;
  }

  if (!ALLOWED_PATH.test(path)) {
    response.status(400).json({ status: 'error', message: 'Unsupported path' });
    return;
  }

  try {
    const upstream = await fetch(`https://api.waqi.info${path}?token=${token}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const body = await upstream.text();

    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');
    // WAQI's free tier is rate limited, so let the edge absorb repeat city lookups.
    response.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    response.status(upstream.status === 200 ? 200 : 502).send(body);
  } catch (err: any) {
    console.error('[AQICN Proxy] upstream failed:', err?.message || err);
    response.status(502).json({ status: 'error', message: 'Upstream failure' });
  }
}
