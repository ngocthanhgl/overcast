const APP_ID     = process.env.ONESIGNAL_APP_ID;
const REST_KEY   = process.env.ONESIGNAL_REST_KEY;
const NOTIF_TYPE = process.argv[2];

const FIREBASE_PROJECT_ID = "nimbus-8e720";
const FIREBASE_API_KEY    = "AIzaSyDhGKcNiaBmNTO0U6JSBo5mu5n0_vSevPM";
const FIREBASE_DB_ID      = "ai-studio-42655dd6-4763-475c-a28c-d0f99b200092";

console.log("Script started, type:", NOTIF_TYPE);
console.log("APP_ID present:", !!APP_ID);
console.log("REST_KEY present:", !!REST_KEY);

const osHeaders = {
  "Content-Type": "application/json",
  "Authorization": `Key ${REST_KEY}`,
};

async function getSubscribers() {
  const res = await fetch(
    `https://onesignal.com/api/v1/players?app_id=${APP_ID}&limit=300`,
    { headers: osHeaders }
  );
  if (!res.ok) {
    console.error("Failed:", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  console.log("Total subscribers:", data.players?.length || 0);
  return data.players || [];
}

async function getUserFromFirestore(playerId) {
  const url =
    `https://firestore.googleapis.com/v1/projects/` +
    `${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DB_ID}` +
    `/documents/users/${playerId}?key=${FIREBASE_API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.fields) return null;
    const f = data.fields;
    const locationValues = f.locations?.arrayValue?.values || [];
    const locations = locationValues.map(v => {
      const m = v.mapValue?.fields || {};
      return {
        name: m.name?.stringValue || "your area",
        lat:  parseFloat(m.lat?.doubleValue  || 0),
        lon:  parseFloat(m.lon?.doubleValue  || 0),
        isCurrent: m.isCurrent?.booleanValue || false,
      };
    });
    if (locations.length === 0) return null;
    const primary = locations.find(l => l.isCurrent) || locations[0];
    if (!primary.lat || !primary.lon) return null;
    return {
      cityName: primary.name,
      lat:      primary.lat,
      lon:      primary.lon,
      alertMorning: f.alertMorningSummaryEnabled?.booleanValue ?? true,
      alertNight:   f.alertNightSummaryEnabled?.booleanValue   ?? true,
      alertSevere:  f.alertSevereEnabled?.booleanValue         ?? true,
    };
  } catch (e) {
    console.warn("Firestore error:", e.message);
    return null;
  }
}

async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto`;
  const res = await fetch(url);
  return res.json();
}

function getCondition(code) {
  if (code === 0)  return "Clear sky";
  if (code <= 2)   return "Partly cloudy";
  if (code === 3)  return "Overcast";
  if (code <= 48)  return "Foggy";
  if (code <= 57)  return "Drizzle";
  if (code <= 67)  return "Rain";
  if (code <= 77)  return "Snow";
  if (code <= 82)  return "Rain showers";
  if (code <= 86)  return "Snow showers";
  if (code >= 95)  return "Thunderstorm";
  return "Cloudy";
}

async function sendToPlayer(playerId, title, body) {
  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: osHeaders,
    body: JSON.stringify({
      app_id:             APP_ID,
      include_player_ids: [playerId],
      headings:           { en: title },
      contents:           { en: body },
    }),
  });
  if (!res.ok) {
    console.error("Send failed:", res.status, await res.text());
    return;
  }
  const result = await res.json();
  console.log("Sent:", title, "→ recipients:", result.recipients);
}

async function run() {
  const subscribers = await getSubscribers();
  if (subscribers.length === 0) {
    console.log("No subscribers. Exiting.");
    return;
  }

  let sent = 0;
  let skipped = 0;

  for (const sub of subscribers) {
    const user = await getUserFromFirestore(sub.id);
    if (!user) {
      skipped++;
      continue;
    }

    const { cityName, lat, lon } = user;
    console.log("Processing:", cityName);

    const weather      = await getWeather(lat, lon);
    const temp         = Math.round(weather.current.temperature_2m);
    const feels        = Math.round(weather.current.apparent_temperature);
    const code         = weather.current.weather_code;
    const high         = Math.round(weather.daily.temperature_2m_max[0]);
    const low          = Math.round(weather.daily.temperature_2m_min[0]);
    const tomorrowHigh = Math.round(weather.daily.temperature_2m_max[1]);
    const tomorrowCode = weather.daily.weather_code[1];

    if (NOTIF_TYPE === "morning" && (user.alertMorning ?? true)) {
      await sendToPlayer(sub.id,
        `${temp}° · Good Morning ☀️`,
        `in ${cityName} · feels ${feels}° · H:${high}° L:${low}°`
      );
      sent++;
    }

    if (NOTIF_TYPE === "night" && (user.alertNight ?? true)) {
      await sendToPlayer(sub.id,
        `${tomorrowHigh}° high tomorrow 🌙`,
        `in ${cityName} · ${getCondition(tomorrowCode)} overnight`
      );
      sent++;
    }

    if (NOTIF_TYPE === "severe" && (user.alertSevere ?? true)) {
      if (feels >= 42) {
        await sendToPlayer(sub.id,
          `🔥 Extreme Heat Alert`,
          `in ${cityName} · Feels ${feels}°. Stay hydrated.`
        );
        sent++;
      } else if (temp <= 2) {
        await sendToPlayer(sub.id,
          `🥶 Extreme Cold Alert`,
          `in ${cityName} · ${temp}°. Bundle up.`
        );
        sent++;
      } else if (code >= 95) {
        await sendToPlayer(sub.id,
          `⛈ Storm Alert`,
          `in ${cityName} · Thunderstorm active. Stay indoors.`
        );
        sent++;
      } else {
        console.log("No severe conditions for:", cityName);
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Done. Sent: ${sent} Skipped: ${skipped}`);
}

run().catch(err => {
  console.error("Crashed:", err);
  process.exit(1);
});
