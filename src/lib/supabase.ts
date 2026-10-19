import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** null når Supabase ikke er satt opp – da kjører appen bare lokalt. */
export const supabase = url && key ? createClient(url, key) : null
