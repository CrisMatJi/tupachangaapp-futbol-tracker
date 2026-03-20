/**
 * Hook de React Query para partidos.
 *
 * Uso:
 *   const { data: matches } = useMatches()
 *   const { data: match } = useMatchDetail(matchId)
 *   const { data: matchPlayers } = useMatchPlayers(matchId)
 *   const { data: votes } = useMatchVotes(matchId)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import {
  fetchMatchesByUser,
  fetchMatchById,
  fetchMatchPlayersByMatch,
  fetchVotesByMatch,
  createMatchWithTeams,
  updateMatchResult,
  updateMatchPlayers,
  deleteMatch,
} from '@/services/matches'
import type { MatchType, Player } from '@/types'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMatches() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['matches', user?.id],
    queryFn: () => fetchMatchesByUser(user!.id),
    enabled: !!user,
  })
}

export function useMatchDetail(matchId: string | undefined) {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: () => fetchMatchById(matchId!),
    enabled: !!matchId,
  })
}

export function useMatchPlayers(matchId: string | undefined) {
  return useQuery({
    queryKey: ['matchPlayers', matchId],
    queryFn: () => fetchMatchPlayersByMatch(matchId!),
    enabled: !!matchId,
  })
}

export function useMatchVotes(matchId: string | undefined) {
  return useQuery({
    queryKey: ['votes', matchId],
    queryFn: () => fetchVotesByMatch(matchId!),
    enabled: !!matchId,
    refetchInterval: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateMatch() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      matchType,
      date,
      teamA,
      teamB,
    }: {
      matchType: MatchType
      date: string
      teamA: Player[]
      teamB: Player[]
    }) => createMatchWithTeams(user!.id, matchType, date, teamA, teamB),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  })
}

export function useUpdateMatchResult() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      matchId,
      scoreA,
      scoreB,
      status,
      mvpPlayerId,
    }: {
      matchId: string
      scoreA: number
      scoreB: number
      status: string
      mvpPlayerId?: string | null
    }) => updateMatchResult(matchId, scoreA, scoreB, status, mvpPlayerId),
    onSuccess: (_data, { matchId }) => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })
}

export function useUpdateMatchPlayers() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      matchId,
      teamA,
      teamB,
    }: {
      matchId: string
      teamA: Player[]
      teamB: Player[]
    }) => updateMatchPlayers(matchId, user!.id, teamA, teamB),
    onSuccess: (_data, { matchId }) => {
      queryClient.invalidateQueries({ queryKey: ['matchPlayers', matchId] })
    },
  })
}

export function useDeleteMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (matchId: string) => deleteMatch(matchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  })
}
