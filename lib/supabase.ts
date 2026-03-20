import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// During SSR (static export), window is undefined — skip storage to avoid crash
const storage = Platform.OS === 'web' && typeof window === 'undefined'
  ? undefined
  : AsyncStorage

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // En web necesita detectar el ?code= del callback OAuth
    detectSessionInUrl: Platform.OS === 'web',
  },
})
