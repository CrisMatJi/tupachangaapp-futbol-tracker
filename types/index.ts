export type Position = 'POR' | 'DEF' | 'MD' | 'AT'
export type MatchType = '5v5' | '6v6' | '7v7' | '11v11'
export type Team = 'A' | 'B'

export interface Player {
  id: string
  userId: string
  name: string
  skill: number
  position?: Position
  createdAt: string
}

export interface Match {
  id: string
  userId: string
  date: string
  matchType: MatchType
  status: string  // 'created' | 'finished'
  scoreA?: number
  scoreB?: number
  mvpPlayerId?: string
  createdAt: string
}

export interface MatchPlayer {
  id: string
  matchId: string
  playerId: string
  userId: string
  team?: Team
  createdAt: string
  // joined
  playerName?: string
  playerSkill?: number
  playerPosition?: Position
}

export interface MatchWithPlayers extends Match {
  players: MatchPlayer[]
  teamA: MatchPlayer[]
  teamB: MatchPlayer[]
}

export const MATCH_TYPE_LIMITS: Record<MatchType, number> = {
  '5v5': 5,
  '6v6': 6,
  '7v7': 7,
  '11v11': 11,
}
