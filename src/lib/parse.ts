import { addDays, toISO, WEEKDAYS } from './date'
import type { Priority } from './types'

export interface ParsedTask {
  title: string
  due?: string
  time?: string
  priority?: Priority
  project?: string
}

const MONTH_PREFIX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, mai: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, des: 11,
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Tolker hurtiglegging på norsk, f.eks.
 * «Ring tannlegen i morgen kl 14 #helse p1».
 */
export function parseQuickAdd(input: string, now = new Date()): ParsedTask {
  let s = ` ${input} `
  const out: ParsedTask = { title: '' }
  const today = toISO(now)

  // Kjører regex mot teksten; fjerner treffet hvis fn ikke returnerer false.
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = s.match(re)
    if (m && fn(m) !== false) s = s.replace(m[0], ' ')
  }
  const setDue = (fn: (m: RegExpMatchArray) => string | undefined) => (m: RegExpMatchArray) => {
    const due = fn(m)
    if (!due) return false
    out.due = due
  }
  const dateRule = (re: RegExp, fn: (m: RegExpMatchArray) => string | undefined) => {
    if (!out.due) take(re, setDue(fn))
  }

  take(/\s[pP]([1-4])(?=\s)/, (m) => {
    out.priority = Number(m[1]) as Priority
  })

  take(/\s#([\p{L}\p{N}_-]+)(?=\s)/u, (m) => {
    out.project = m[1]
  })

  take(/\skl\.?\s*(\d{1,2})(?:[:.](\d{2}))?(?=\s)/iu, (m) => {
    const h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    if (h > 23 || min > 59) return false
    out.time = `${pad(h)}:${pad(min)}`
  })

  dateRule(/\si\s?dag(?=\s)/iu, () => today)
  dateRule(/\si\s?overmorgen(?=\s)/iu, () => addDays(today, 2))
  dateRule(/\si\s?morgen(?=\s)/iu, () => addDays(today, 1))
  dateRule(/\som\s(\d{1,3})\s(dag|dager|uke|uker)(?=\s)/iu, (m) =>
    addDays(today, Number(m[1]) * (m[2].toLowerCase().startsWith('uke') ? 7 : 1)),
  )
  dateRule(/\sneste\suke(?=\s)/iu, () => addDays(today, ((8 - now.getDay()) % 7) || 7))
  dateRule(new RegExp(`\\s(?:på\\s)?(${WEEKDAYS.join('|')})(?=\\s)`, 'iu'), (m) => {
    const target = WEEKDAYS.indexOf(m[1].toLowerCase())
    return addDays(today, ((target - now.getDay() + 7) % 7) || 7)
  })
  // 21.10, 21/10, 21.10.2026
  dateRule(/\s(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s)/u, (m) =>
    buildDate(now, Number(m[1]), Number(m[2]) - 1, m[3]),
  )
  // 21. okt, 3 januar
  dateRule(/\s(\d{1,2})\.?\s(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)\p{L}*(?=\s)/iu, (m) =>
    buildDate(now, Number(m[1]), MONTH_PREFIX[m[2].toLowerCase()]),
  )

  out.title = s.replace(/\s+/g, ' ').trim()
  return out
}

function buildDate(now: Date, day: number, month: number, year?: string): string | undefined {
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined
  let y = year ? Number(year.length === 2 ? `20${year}` : year) : now.getFullYear()
  let d = new Date(y, month, day)
  if (d.getMonth() !== month) return undefined // f.eks. 31.02
  // Uten årstall: en dato som allerede er passert betyr neste år.
  if (!year && toISO(d) < toISO(now)) {
    y += 1
    d = new Date(y, month, day)
  }
  return toISO(d)
}
