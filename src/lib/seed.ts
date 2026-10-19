import { addDays, todayISO } from './date'
import { uid } from './id'
import type { AppData, Block, BlockType } from './types'

const b = (type: BlockType, text: string, checked?: boolean): Block => ({ id: uid(), type, text, checked })

export function seedData(): AppData {
  const today = todayISO()
  const hjem = { id: uid(), name: 'Hjem', color: '#22a06b' }
  const jobb = { id: uid(), name: 'Jobb', color: '#3b82f6' }
  const helse = { id: uid(), name: 'Helse', color: '#e5484d' }
  const now = Date.now()
  const t = (title: string, extra: Partial<AppData['tasks'][number]> = {}) => ({
    id: uid(), title, done: false, priority: 4 as const, createdAt: now, ...extra,
  })

  return {
    projects: [hjem, jobb, helse],
    tasks: [
      t('Prøv hurtiglegging: skriv «Handle melk i morgen #hjem p2»', { due: today, priority: 1 }),
      t('Trykk Ctrl/⌘ + K for å søke overalt', { due: today, priority: 3 }),
      t('Bestill time hos tannlegen', { due: today, time: '14:00', projectId: helse.id, priority: 2 }),
      t('Forberede møte om budsjett', { due: addDays(today, 1), projectId: jobb.id, priority: 2 }),
      t('Bytte filter i ventilasjonen', { due: addDays(today, 3), projectId: hjem.id }),
      t('Svare på e-post fra regnskap', { due: addDays(today, -1), projectId: jobb.id, priority: 1 }),
      t('Ny løpesko', { projectId: helse.id }),
      t('Ideer til helgetur'),
    ],
    pages: [
      {
        id: uid(),
        title: 'Velkommen',
        icon: '👋',
        updatedAt: now,
        blocks: [
          b('p', 'Dette er en side. Skriv fritt – alt lagres automatisk.'),
          b('h2', 'Snarveier i editoren'),
          b('bullet', 'Skriv «/» på en tom linje for å velge blokktype'),
          b('bullet', '«# » gir stor overskrift, «## » mindre overskrift'),
          b('bullet', '«[] » gir sjekkliste, «- » gir punktliste, «> » gir sitat'),
          b('todo', 'Lag din første egen side', false),
          b('todo', 'Utforsk visningen «I dag»', true),
          b('quote', 'Enkelhet er den ultimate sofistikasjon.'),
        ],
      },
      {
        id: uid(),
        title: 'Leseliste',
        icon: '📚',
        updatedAt: now,
        blocks: [
          b('todo', 'Atomic Habits – James Clear', true),
          b('todo', 'Deep Work – Cal Newport', false),
          b('todo', 'Sult – Knut Hamsun', false),
        ],
      },
    ],
  }
}
