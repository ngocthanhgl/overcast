import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

/**
 * Server route for MET Norway. Their terms ask for an identifying User-Agent, which a
 * browser is not allowed to set, so the client uses this route as a fallback.
 */
export default async function handler(request: any, response: any) {
  const url = new URL(request.url || '', 'http://localhost');
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));

  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    response.status(400).json({ error: true, message: 'lat and lon are required' });
    return;
  }

  const targetUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'OvercastWeatherApp/1.0 (https://github.com/ngocthanhgl/overcast-app)',
        'Accept': 'application/json',
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      response.status(upstream.status || 502).send(text);
      return;
    }

    response.status(200).json(await upstream.json());
  } catch (err: any) {
    console.error(`[MET Norway Proxy] Failed for ${targetUrl}:`, err);
    response.status(502).json({ error: true, message: err?.message || 'Proxy Error' });
  }
}
