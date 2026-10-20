import type { Project } from '../lib/types'

/** Prosjektets ikon (emoji), eller en farget prikk når det ikke har ikon. */
export function ProjectIcon({ project, size = 'md' }: { project: Project; size?: 'sm' | 'md' | 'lg' }) {
  if (project.icon) {
    const text = { sm: 'text-[13px]', md: 'text-[16px]', lg: 'text-[30px]' }[size]
    return <span className={`shrink-0 leading-none ${text}`}>{project.icon}</span>
  }
  const dot = { sm: 7, md: 10, lg: 14 }[size]
  const ring = { sm: 3, md: 4, lg: 5 }[size]
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: dot, height: dot, background: project.color, boxShadow: `0 0 0 ${ring}px color-mix(in srgb, ${project.color} 16%, transparent)` }}
    />
  )
}
