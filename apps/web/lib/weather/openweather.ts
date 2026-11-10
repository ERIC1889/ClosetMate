import type { Weather } from '@/lib/recommend/candidate_generator';

const KEY = process.env.OPENWEATHER_API_KEY;

function mapCondition(main: string): Weather['condition'] {
  const lower = main.toLowerCase();
  if (lower.includes('rain') || lower.includes('drizzle')) return 'rain';
  if (lower.includes('snow')) return 'snow';
  if (lower.includes('cloud')) return 'cloudy';
  return 'sunny';
}

export async function fetchWeather(
  lat: number,
  lng: number
): Promise<Weather | null> {
  if (!KEY) return null;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    main?: { temp: number };
    weather?: { main: string }[];
  };
  if (!json.main || !json.weather?.[0]) return null;
  return {
    tempC: json.main.temp,
    condition: mapCondition(json.weather[0].main),
  };
}
