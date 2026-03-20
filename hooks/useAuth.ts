import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Escuchar cambios de auth (también maneja el intercambio de ?code= del OAuth web)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    // Disparar la detección inicial (incluye intercambio de código OAuth si hay ?code= en la URL)
    supabase.auth.getSession()
    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isAuthenticated: !!user }
}
