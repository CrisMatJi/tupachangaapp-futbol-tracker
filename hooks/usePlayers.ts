/**
 * Hook de React Query para jugadores.
 *
 * Centraliza la configuración de queryKey y queryFn para que
 * todas las pantallas compartan exactamente la misma caché.
 *
 * Uso:
 *   const { data: players, isLoading } = usePlayers()        // ordenado por nombre
 *   const { data: players, isLoading } = usePlayersRecent()  // ordenado por fecha
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import {
  fetchPlayersByName,
  fetchPlayersRecent,
  insertPlayer,
  updatePlayer,
  deletePlayer,
} from '@/services/players'
import type { Player, Position } from '@/types'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Jugadores del usuario ordenados por nombre (para CreateMatch). */
export function usePlayers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['players', user?.id, 'byName'],
    queryFn: () => fetchPlayersByName(user!.id),
    enabled: !!user,
  })
}

/** Jugadores del usuario ordenados por fecha de creación (para PlayersList). */
export function usePlayersRecent() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['players', user?.id],
    queryFn: () => fetchPlayersRecent(user!.id),
    enabled: !!user,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePlayer() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      name,
      skill,
      position,
    }: {
      name: string
      skill: number
      position: Position
    }) => insertPlayer(user!.id, name, skill, position),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  })
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: Partial<Player> & { id: string }) => updatePlayer(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  })
}

export function useDeletePlayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePlayer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
  })
}
