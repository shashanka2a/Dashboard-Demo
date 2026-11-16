import type { ProjectRow } from '@/lib/resolve-project';

export type WeatherTimeSnapshot = {
  /** e.g. "9 AM" */
  timeLabel: string;
  tempF: number;
  conditionLabel: string;
  windMph: number | null;
  humidityPct: number | null;
};

export type DayWeatherReport = {
  highF: number;
  lowF: number;
  conditionLabel: string;
  wmoCode: number;
  precipInches: number | null;
  windMph: number | null;
  /** Local-time readings at 9 AM, 12 PM, and 4 PM when hourly data is available. */
  snapshots: WeatherTimeSnapshot[];
};

/** Map WMO code to ReportCard icon bucket (sunny / rainy / cloudy). */
export function wmoToCardCondition(code: number): 'sunny' | 'rainy' | 'cloudy' {
  if (code === 0) return 'sunny';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) return 'rainy';
  return 'cloudy';
}

function wmoToLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Cloudy / fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  return 'Storms / heavy precip';
}

/** Match sidebar: historical days use archive API, today/future use forecast. */
function isHistoricalDate(dateYmd: string): boolean {
  const d = new Date(`${dateYmd}T12:00:00`);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  return d < startToday;
}

function hourFromLocalIso(t: string): number {
  const m = t.match(/T(\d{2}):/);
  return m ? parseInt(m[1], 10) : -1;
}

const REPORT_WEATHER_SLOTS: { hour: number; timeLabel: string }[] = [
  { hour: 9, timeLabel: '9 AM' },
  { hour: 12, timeLabel: '12 PM' },
  { hour: 16, timeLabel: '4 PM' },
];

function buildSnapshotsFromHourly(hourly: {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
  wind_speed_10m?: (number | null)[];
  relative_humidity_2m?: (number | null)[];
}): WeatherTimeSnapshot[] {
  const out: WeatherTimeSnapshot[] = [];
  for (const slot of REPORT_WEATHER_SLOTS) {
    const idx = hourly.time.findIndex((t) => hourFromLocalIso(t) === slot.hour);
    if (idx < 0) continue;
    const temp = hourly.temperature_2m[idx];
    const code = hourly.weather_code[idx];
    if (typeof temp !== 'number' || !Number.isFinite(temp)) continue;
    const wind = hourly.wind_speed_10m?.[idx];
    const humidity = hourly.relative_humidity_2m?.[idx];
    out.push({
      timeLabel: slot.timeLabel,
      tempF: Math.round(temp),
      conditionLabel: wmoToLabel(typeof code === 'number' ? code : 0),
      windMph: typeof wind === 'number' && Number.isFinite(wind) ? Math.round(wind) : null,
      humidityPct: typeof humidity === 'number' && Number.isFinite(humidity) ? Math.round(humidity) : null,
    });
  }
  return out;
}

/**
 * Daily weather for reports: hi/lo summary + local 9 AM / 12 PM / 4 PM snapshots (Open-Meteo).
 */
export async function fetchDayWeatherForReport(
  project: Pick<ProjectRow, 'zip_code' | 'city' | 'state'>,
  dateYmd: string
): Promise<DayWeatherReport | null> {
  const zip = project.zip_code?.trim();
  const cityState = [project.city?.trim(), project.state?.trim()].filter(Boolean).join(', ');
  const geoQuery = zip || cityState || '';
  if (!geoQuery) return null;

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(geoQuery)}&count=1&language=en&format=json`
    );
    if (!geoRes.ok) return null;
    const geoData = (await geoRes.json()) as { results?: { latitude: number; longitude: number }[] };
    const hit = geoData.results?.[0];
    if (!hit) return null;

    const { latitude, longitude } = hit;
    const endpoint = isHistoricalDate(dateYmd)
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      start_date: dateYmd,
      end_date: dateYmd,
      daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max',
      hourly: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m',
      timezone: 'auto',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
    });

    const wRes = await fetch(`${endpoint}?${params.toString()}`);
    if (!wRes.ok) return null;
    const wData = (await wRes.json()) as {
      daily?: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        weather_code: number[];
        precipitation_sum?: (number | null)[];
        wind_speed_10m_max?: (number | null)[];
      };
      hourly?: {
        time: string[];
        temperature_2m: number[];
        weather_code: number[];
        wind_speed_10m?: (number | null)[];
        relative_humidity_2m?: (number | null)[];
      };
    };

    const d = wData.daily;
    if (!d?.temperature_2m_max?.length || !d.temperature_2m_min?.length || !d.weather_code?.length) return null;

    const i = 0;
    const highF = Math.round(d.temperature_2m_max[i]!);
    const lowF = Math.round(d.temperature_2m_min[i]!);
    const wmoCode = d.weather_code[i] ?? 0;
    const precip = d.precipitation_sum?.[i];
    const wind = d.wind_speed_10m_max?.[i];
    const snapshots = wData.hourly ? buildSnapshotsFromHourly(wData.hourly) : [];

    return {
      highF,
      lowF,
      conditionLabel: wmoToLabel(wmoCode),
      wmoCode,
      precipInches: typeof precip === 'number' && Number.isFinite(precip) ? precip : null,
      windMph: typeof wind === 'number' && Number.isFinite(wind) ? Math.round(wind) : null,
      snapshots,
    };
  } catch {
    return null;
  }
}
