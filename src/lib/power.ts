export interface PowerPrices {
  hours: number[] // kr/kWh inkl. mva, én per time (0–23)
  area: string
}

/** Strømområde for Ålesund: NO3 (Midt-Norge). */
export const POWER_AREA = 'NO3'
const VAT = 1.25 // 25 % mva i NO1–NO3 og NO5

/**
 * Spotpriser fra hvakosterstrommen.no (åpent API). Leveres per time eller per kvarter;
 * kvartersverdier slås sammen til timesnitt. Uten nettleie og påslag.
 */
export async function fetchPowerPrices(date = new Date(), area = POWER_AREA): Promise<PowerPrices> {
  const y = date.getFullYear()
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const res = await fetch(`https://www.hvakosterstrommen.no/api/v1/prices/${y}/${md}_${area}.json`)
  if (!res.ok) throw new Error('Fant ikke strømpriser')
  const rows = (await res.json()) as { NOK_per_kWh: number; time_start: string }[]
  const sums = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }))
  for (const r of rows) {
    const h = new Date(r.time_start).getHours()
    sums[h].sum += r.NOK_per_kWh
    sums[h].n++
  }
  return { area, hours: sums.map((s) => (s.n ? (s.sum / s.n) * VAT : 0)) }
}

export const formatKr = (n: number) => n.toFixed(2).replace('.', ',')

/** Billigste og dyreste sammenhengende to-timersvindu. */
export function cheapestAndPriciest(hours: number[]): { cheap: number; dear: number } {
  let cheap = 0
  let dear = 0
  for (let h = 0; h < 23; h++) {
    if (hours[h] + hours[h + 1] < hours[cheap] + hours[cheap + 1]) cheap = h
    if (hours[h] + hours[h + 1] > hours[dear] + hours[dear + 1]) dear = h
  }
  return { cheap, dear }
}
