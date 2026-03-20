/**
 * Capa de acceso a datos — Jugadores.
 *
 * Todas las operaciones de Supabase relacionadas con la tabla `players`
 * están aquí. Las pantallas sólo llaman estas funciones (o usan los hooks
 * de /hooks/usePlayers.ts que las envuelven en React Query).
 */
import { supabase } from '@/lib/supabase'
import type { Player, Position } from '@/types'

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapPlayer(r: any): Player {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    skill: r.skill,
    position: r.position,
    createdAt: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Lista de jugadores ordenados por nombre (usada en CreateMatch). */
export async function fetchPlayersByName(userId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .order('name')
  if (error) throw error
  return (data ?? []).map(mapPlayer)
}

/** Lista de jugadores ordenados por fecha de creación (usada en PlayersList). */
export async function fetchPlayersRecent(userId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPlayer)
}

/** Comprueba si ya existe un jugador con ese nombre (case-insensitive). */
export async function playerNameExists(userId: string, name: string): Promise<boolean> {
  const { data } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', name.trim())
    .limit(1)
  return (data?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function insertPlayer(
  userId: string,
  name: string,
  skill: number,
  position: Position
): Promise<void> {
  const { error } = await supabase.from('players').insert({
    id: `player_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId,
    name: name.trim(),
    skill,
    position,
    created_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function updatePlayer(
  id: string,
  data: { name?: string; skill?: number; position?: Position | null }
): Promise<void> {
  const { error } = await supabase.from('players').update(data).eq('id', id)
  if (error) throw error
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}
