import { balanceTeams, avgSkill } from '@/utils/teamBalance'
import type { Player } from '@/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    userId: 'user1',
    name: overrides.id,
    skill: 3,
    createdAt: '2024-01-01',
    ...overrides,
  }
}

const POR = (id: string, skill: number) => makePlayer({ id, skill, position: 'POR' })
const DEF = (id: string, skill: number) => makePlayer({ id, skill, position: 'DEF' })
const AT  = (id: string, skill: number) => makePlayer({ id, skill, position: 'AT' })
const MD  = (id: string, skill: number) => makePlayer({ id, skill, position: 'MD' })

// ---------------------------------------------------------------------------
// avgSkill
// ---------------------------------------------------------------------------

describe('avgSkill', () => {
  it('devuelve 0.0 para un array vacío', () => {
    expect(avgSkill([])).toBe('0.0')
  })

  it('devuelve el skill exacto para un solo jugador', () => {
    expect(avgSkill([makePlayer({ id: 'p1', skill: 4 })])).toBe('4.0')
  })

  it('calcula la media correctamente', () => {
    const players = [
      makePlayer({ id: 'p1', skill: 2 }),
      makePlayer({ id: 'p2', skill: 4 }),
    ]
    expect(avgSkill(players)).toBe('3.0')
  })

  it('redondea a 1 decimal', () => {
    const players = [
      makePlayer({ id: 'p1', skill: 1 }),
      makePlayer({ id: 'p2', skill: 2 }),
      makePlayer({ id: 'p3', skill: 3 }),
    ]
    // (1+2+3)/3 = 2.0
    expect(avgSkill(players)).toBe('2.0')
  })
})

// ---------------------------------------------------------------------------
// balanceTeams
// ---------------------------------------------------------------------------

describe('balanceTeams', () => {
  it('divide exactamente la mitad de jugadores en cada equipo', () => {
    const players = [
      AT('p1', 5), AT('p2', 4), DEF('p3', 3), DEF('p4', 2),
      POR('p5', 5), POR('p6', 4), MD('p7', 3), MD('p8', 2),
      AT('p9', 1), AT('p10', 1),
    ]
    const { teamA, teamB } = balanceTeams(players)
    expect(teamA).toHaveLength(5)
    expect(teamB).toHaveLength(5)
  })

  it('produce equipos con diferencia de skill ≤ 1', () => {
    const players = [
      AT('p1', 5), AT('p2', 5), DEF('p3', 4), DEF('p4', 4),
      POR('p5', 3), POR('p6', 3), MD('p7', 2), MD('p8', 2),
      AT('p9', 1), AT('p10', 1),
    ]
    const { teamA, teamB } = balanceTeams(players)
    const sumA = teamA.reduce((s, p) => s + p.skill, 0)
    const sumB = teamB.reduce((s, p) => s + p.skill, 0)
    expect(Math.abs(sumA - sumB)).toBeLessThanOrEqual(1)
  })

  it('no pierde ningún jugador', () => {
    const players = [
      AT('p1', 5), AT('p2', 4), DEF('p3', 3), DEF('p4', 2),
      POR('p5', 5), POR('p6', 4), MD('p7', 3), MD('p8', 2),
      AT('p9', 1), AT('p10', 1),
    ]
    const { teamA, teamB } = balanceTeams(players)
    const allIds = [...teamA, ...teamB].map((p) => p.id).sort()
    const originalIds = players.map((p) => p.id).sort()
    expect(allIds).toEqual(originalIds)
  })

  it('no modifica el array de entrada', () => {
    const players = [
      AT('p1', 5), DEF('p2', 4), POR('p3', 3), MD('p4', 2),
    ]
    const originalOrder = players.map((p) => p.id)
    balanceTeams(players)
    expect(players.map((p) => p.id)).toEqual(originalOrder)
  })

  it('funciona con partidos 11v11 (22 jugadores)', () => {
    const players = Array.from({ length: 22 }, (_, i) =>
      makePlayer({ id: `p${i}`, skill: (i % 5) + 1 })
    )
    const { teamA, teamB } = balanceTeams(players)
    expect(teamA).toHaveLength(11)
    expect(teamB).toHaveLength(11)
  })
})
