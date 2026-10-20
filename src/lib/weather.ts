export interface Weather {
  temp: number
  code: number
  wind: number
  max: number
  min: number
  rain: number // sannsynlighet for nedbør i dag, %
  hours: { time: string; temp: number; code: number }[]
}

/** Henter dagens vær fra Open-Meteo (gratis, uten nøkkel). */
export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code,wind_speed_10m' +
    '&hourly=temperature_2m,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&wind_speed_unit=ms&timezone=Europe%2FOslo&forecast_days=2'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Kunne ikke hente været')
  const d = await res.json()
  const now = d.current.time.slice(0, 13) // «2026-10-20T10»
  const start = (d.hourly.time as string[]).findIndex((t) => t.slice(0, 13) >= now)
  return {
    temp: Math.round(d.current.temperature_2m),
    code: d.current.weather_code,
    wind: Math.round(d.current.wind_speed_10m),
    max: Math.round(d.daily.temperature_2m_max[0]),
    min: Math.round(d.daily.temperature_2m_min[0]),
    rain: d.daily.precipitation_probability_max[0] ?? 0,
    hours: Array.from({ length: 6 }, (_, i) => start + 1 + i * 2).map((i) => ({
      time: (d.hourly.time[i] as string).slice(11, 16),
      temp: Math.round(d.hourly.temperature_2m[i]),
      code: d.hourly.weather_code[i],
    })),
  }
}

/** WMO-værkoder fra Open-Meteo, på norsk. */
export function weatherText(code: number): string {
  if (code === 0) return 'Klarvær'
  if (code <= 2) return 'Lettskyet'
  if (code === 3) return 'Skyet'
  if (code <= 48) return 'Tåke'
  if (code <= 57) return 'Yr'
  if (code <= 67) return 'Regn'
  if (code <= 77) return 'Snø'
  if (code <= 82) return 'Regnbyger'
  if (code <= 86) return 'Snøbyger'
  return 'Torden'
}

export type WeatherKind = 'sun' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm'

export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'sun'
  if (code <= 2) return 'partly'
  if (code === 3) return 'cloud'
  if (code <= 48) return 'fog'
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rain'
  if (code <= 86) return 'snow'
  return 'storm'
}
