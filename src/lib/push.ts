import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** Hvor varsler står på denne enheten. */
export async function pushState(): Promise<PushState> {
  if (!supabase || !VAPID_PUBLIC_KEY) return 'unsupported'
  // iPhone støtter bare varsler når appen er lagt på hjemskjermen.
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Ber om tillatelse, registrerer enheten og lagrer abonnementet i Supabase. Må kalles fra et klikk. */
export async function enablePush(): Promise<PushState> {
  if (!supabase || !VAPID_PUBLIC_KEY) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off'
}

/** Ber serveren sende et testvarsel til alle enhetene dine. Returnerer antall enheter. */
export async function sendTestPush(): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } })
  if (error) throw new Error(error.message)
  return (data as { sent: number }).sent
}
