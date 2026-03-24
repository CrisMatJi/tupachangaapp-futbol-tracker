/**
 * Definición centralizada de posiciones de fútbol.
 * Usada en CreatePlayer, PlayersList, CreateMatch y MatchDetail.
 */
import type { Position } from '@/types'

export const POSITIONS: {
  key: Position
  label: string
  iconName: string
  color: string
}[] = [
  { key: 'POR', label: 'Portero',        iconName: 'handball',        color: '#F59E0B' },
  { key: 'DEF', label: 'Defensa',        iconName: 'shield-half-full', color: '#3B82F6' },
  { key: 'MD',  label: 'Mediocampista',  iconName: 'run-fast',         color: '#8B5CF6' },
  { key: 'AT',  label: 'Atacante',       iconName: 'soccer',           color: '#EF4444' },
]

/** Mapa para lookup rápido por key de posición. */
export const POSITIONS_INFO: Record<Position, { iconName: string; color: string }> =
  Object.fromEntries(
    POSITIONS.map((p) => [p.key, { iconName: p.iconName, color: p.color }])
  ) as Record<Position, { iconName: string; color: string }>

/** Devuelve el iconName y color de una posición, o null si no se encuentra. */
export function getPositionInfo(pos?: string | null): { iconName: string; color: string } | null {
  return pos ? (POSITIONS_INFO[pos as Position] ?? null) : null
}
