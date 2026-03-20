/**
 * Lógica pura de equilibrado de equipos.
 * Sin dependencias de UI ni de Supabase — sólo cálculos sobre Player[].
 */
import type { Player } from '@/types'

/** Diferencia de distribución posicional entre dos equipos (cuanto menor, más equilibrado). */
function posImbalance(teamA: Player[], teamB: Player[]): number {
  return ['POR', 'DEF', 'MD', 'AT'].reduce((score, pos) => {
    const cA = teamA.filter((p) => p.position === pos).length
    const cB = teamB.filter((p) => p.position === pos).length
    return score + Math.abs(cA - cB)
  }, 0)
}

/**
 * Distribuye jugadores en dos equipos intentando minimizar la diferencia de skill total
 * y, como segundo criterio, la diferencia de distribución posicional.
 *
 * Algoritmo:
 * 1. Distribución greedy por skill (prioridad principal).
 * 2. Intercambios de jugadores con el mismo skill para mejorar el balance de posiciones.
 */
export function balanceTeams(players: Player[]): { teamA: Player[]; teamB: Player[] } {
  const sorted = [...players].sort((a, b) => b.skill - a.skill)
  let teamA: Player[] = []
  let teamB: Player[] = []
  let sumA = 0
  let sumB = 0

  for (const player of sorted) {
    if (sumA <= sumB) {
      teamA.push(player)
      sumA += player.skill
    } else {
      teamB.push(player)
      sumB += player.skill
    }
  }

  let improved = true
  while (improved) {
    improved = false
    const curScore = posImbalance(teamA, teamB)
    for (let i = 0; i < teamA.length && !improved; i++) {
      for (let j = 0; j < teamB.length && !improved; j++) {
        if (teamA[i].skill !== teamB[j].skill) continue
        const newA = [...teamA]; newA[i] = teamB[j]
        const newB = [...teamB]; newB[j] = teamA[i]
        if (posImbalance(newA, newB) < curScore) {
          teamA = newA
          teamB = newB
          improved = true
        }
      }
    }
  }

  return { teamA, teamB }
}

/** Media de skill formateada a 1 decimal. Devuelve '0.0' para arrays vacíos. */
export function avgSkill(players: Player[]): string {
  if (!players.length) return '0.0'
  return (players.reduce((acc, p) => acc + p.skill, 0) / players.length).toFixed(1)
}
