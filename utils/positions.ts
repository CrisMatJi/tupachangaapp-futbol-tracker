/**
 * Definición centralizada de posiciones de fútbol.
 * Usada en CratePlayer, PlayersList, CreateMatch y MatchDetail.
 */
import type { Position } from '@/types'

export const POSITIONS: {
  key: Position
  label: string
  emoji: string
  color: string
}[] = [
  { key: 'POR', label: 'Portero',        emoji: '🧤', color: '#F59E0B' },
  { key: 'DEF', label: 'Defensa',        emoji: '🛡️', color: '#3B82F6' },
  { key: 'MD',  label: 'Mediocampista',  emoji: '🎯', color: '#8B5CF6' },
  { key: 'AT',  label: 'Atacante',       emoji: '⚡', color: '#EF4444' },
]

/** Mapa para lookup rápido por key de posición. */
export const POSITIONS_INFO: Record<Position, { emoji: string; color: string }> =
  Object.fromEntries(
    POSITIONS.map((p) => [p.key, { emoji: p.emoji, color: p.color }])
  ) as Record<Position, { emoji: string; color: string }>

/** Devuelve el emoji y color de una posición, o null si no se encuentra. */
export function getPositionInfo(pos?: string | null): { emoji: string; color: string } | null {
  return pos ? (POSITIONS_INFO[pos as Position] ?? null) : null
}
