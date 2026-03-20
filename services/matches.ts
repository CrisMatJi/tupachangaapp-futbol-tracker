/**
 * Capa de acceso a datos — Partidos.
 *
 * Todas las operaciones de Supabase relacionadas con `matches`,
 * `match_players` y `votes` están aquí.
 */
import { supabase } from '@/lib/supabase'
import type { Match, MatchPlayer, MatchType, Player } from '@/types'

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapMatch(r: any): Match {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    matchType: r.match_type,
    status: r.status,
    scoreA: r.score_a,
    scoreB: r.score_b,
    mvpPlayerId: r.mvp_player_id,
    createdAt: r.created_at,
  }
}

function mapMatchPlayer(r: any): MatchPlayer {
  return {
    id: r.id,
    matchId: r.match_id,
    playerId: r.player_id,
    userId: r.user_id,
    team: r.team,
    createdAt: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Lista de partidos del usuario, ordenados por fecha de creación descendente. */
export async function fetchMatchesByUser(userId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapMatch)
}

/** Un único partido por id. */
export async function fetchMatchById(matchId: string): Promise<Match> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()
  if (error) throw error
  return mapMatch(data)
}

/** Jugadores de un partido (filas de match_players). */
export async function fetchMatchPlayersByMatch(matchId: string): Promise<MatchPlayer[]> {
  const { data, error } = await supabase
    .from('match_players')
    .select('*')
    .eq('match_id', matchId)
  if (error) throw error
  return (data ?? []).map(mapMatchPlayer)
}

/** Votos de un partido (sólo player_id, para recuento). */
export async function fetchVotesByMatch(matchId: string): Promise<{ player_id: string }[]> {
  const { data, error } = await supabase
    .from('votes')
    .select('player_id')
    .eq('match_id', matchId)
  if (error) throw error
  return data ?? []
}

/** Comprueba si ya existe un partido en esa fecha para el usuario. */
export async function matchDateExists(userId: string, date: string): Promise<boolean> {
  const { data } = await supabase
    .from('matches')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .limit(1)
  return (data?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Crea un partido con sus jugadores en una sola operación (no transacción atómica). */
export async function createMatchWithTeams(
  userId: string,
  matchType: MatchType,
  date: string,
  teamA: Player[],
  teamB: Player[]
): Promise<string> {
  const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const now = new Date().toISOString()

  const { error: matchError } = await supabase.from('matches').insert({
    id: matchId,
    user_id: userId,
    date,
    match_type: matchType,
    status: 'created',
    created_at: now,
  })
  if (matchError) throw matchError

  const rows = [
    ...teamA.map((p, i) => ({
      id: `mp_${matchId}_A_${i}`,
      match_id: matchId,
      player_id: p.id,
      team: 'A',
      user_id: userId,
      created_at: now,
    })),
    ...teamB.map((p, i) => ({
      id: `mp_${matchId}_B_${i}`,
      match_id: matchId,
      player_id: p.id,
      team: 'B',
      user_id: userId,
      created_at: now,
    })),
  ]
  const { error: mpError } = await supabase.from('match_players').insert(rows)
  if (mpError) throw mpError

  return matchId
}

/** Guarda el resultado y MVP de un partido y cambia su status. */
export async function updateMatchResult(
  matchId: string,
  scoreA: number,
  scoreB: number,
  status: string,
  mvpPlayerId?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ score_a: scoreA, score_b: scoreB, status, mvp_player_id: mvpPlayerId ?? null })
    .eq('id', matchId)
  if (error) throw error
}

/** Reemplaza los jugadores de un partido (rehace equipos). */
export async function updateMatchPlayers(
  matchId: string,
  userId: string,
  teamA: Player[],
  teamB: Player[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('match_players')
    .delete()
    .eq('match_id', matchId)
  if (deleteError) throw deleteError

  const now = new Date().toISOString()
  const rows = [
    ...teamA.map((p, i) => ({
      id: `mp_${matchId}_A_${i}_${Date.now()}`,
      match_id: matchId,
      player_id: p.id,
      team: 'A',
      user_id: userId,
      created_at: now,
    })),
    ...teamB.map((p, i) => ({
      id: `mp_${matchId}_B_${i}_${Date.now()}`,
      match_id: matchId,
      player_id: p.id,
      team: 'B',
      user_id: userId,
      created_at: now,
    })),
  ]
  const { error: insertError } = await supabase.from('match_players').insert(rows)
  if (insertError) throw insertError
}

/** Borra un partido y todos sus match_players asociados. */
export async function deleteMatch(matchId: string): Promise<void> {
  const { error: mpError } = await supabase
    .from('match_players')
    .delete()
    .eq('match_id', matchId)
  if (mpError) throw mpError

  const { error } = await supabase.from('matches').delete().eq('id', matchId)
  if (error) throw error
}
