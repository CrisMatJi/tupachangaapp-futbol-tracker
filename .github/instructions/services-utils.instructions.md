---
applyTo: "services/**/*.ts,utils/**/*.ts,types/**/*.ts"
---

# Instrucciones para servicios, utils y tipos

## Capa de servicios (`services/`)

Toda operación contra Supabase va aquí. **Nunca** llamar a `supabase` directamente desde pantallas o componentes.

### Estructura de un servicio

```ts
import { supabase } from '@/lib/supabase'
import type { Player } from '@/types'

// Mapper: snake_case DB → camelCase TS
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

// Query — lanzar error para que React Query lo capture
export async function fetchPlayers(userId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .order('name')
  if (error) throw error
  return (data ?? []).map(mapPlayer)
}

// Mutation — devolver el recurso creado/actualizado
export async function createPlayer(payload: CreatePlayerInput): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert([{ user_id: payload.userId, name: payload.name, skill: payload.skill, position: payload.position }])
    .select()
    .single()
  if (error) throw error
  return mapPlayer(data)
}
```

### Archivos existentes
- `services/players.ts` — CRUD tabla `players`
- `services/matches.ts` — CRUD tablas `matches` y `match_players`

---

## Tipos (`types/index.ts`)

```ts
export type Position = 'POR' | 'DEF' | 'MD' | 'AT'
export type MatchType = '5v5' | '6v6' | '7v7' | '11v11'
export type Team = 'A' | 'B'

export interface Player {
  id: string
  userId: string
  name: string
  skill: number         // 1–5
  position?: Position
  createdAt: string
}

export interface Match {
  id: string
  userId: string
  date: string          // 'YYYY-MM-DD'
  matchType: MatchType
  status: string        // 'created' | 'finished'
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
  team: Team
}
```

---

## Utils

### `utils/positions.ts` — NO modificar la estructura

```ts
import { POSITIONS, POSITIONS_INFO, getPositionInfo } from '@/utils/positions'

// POSITIONS — array completo para grids/selectors
POSITIONS.forEach(p => {
  // p.key: Position, p.label: string, p.iconName: string (MCIcons), p.color: string
})

// POSITIONS_INFO — lookup O(1) por key
const info = POSITIONS_INFO['DEF']  // { iconName: 'shield-half-full', color: '#3B82F6' }

// getPositionInfo — seguro con undefined/null
const info = getPositionInfo(player.position)  // { iconName, color } | null
```

**Valores actuales:**
| key | label | iconName (MCIcons) | color |
|---|---|---|---|
| POR | Portero | `handball` | `#F59E0B` |
| DEF | Defensa | `shield-half-full` | `#3B82F6` |
| MD | Mediocampista | `run-fast` | `#8B5CF6` |
| AT | Atacante | `soccer` | `#EF4444` |

---

### `utils/teamBalance.ts`

```ts
import { balanceTeams, avgSkill } from '@/utils/teamBalance'

// balanceTeams: greedy por skill + swap posicional + shuffle interno
// Cada llamada con los mismos jugadores puede dar distribución diferente (aleatorio en ties de skill)
const { teamA, teamB } = balanceTeams(players)

// avgSkill: media de skill de un equipo (1 decimal)
const media = avgSkill(teamA)  // e.g. '3.5'
```

---

### `utils/date.ts`

```ts
import { formatDate } from '@/utils/date'
// formatDate('2026-03-24') → '24 Mar 2026'
```

---

## Supabase Auth (`lib/supabase.ts`)

```ts
import { supabase } from '@/lib/supabase'
// Usar solo en services/ y en useAuth.ts
// En pantallas: const { user } = useAuth()
```

Variables de entorno (`.env.local`):
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Tests (`__tests__/`)

```bash
npm test                    # jest --watchAll=false
npm run test:watch          # modo watch
npm run test:coverage       # con cobertura
```

Convenciones:
- Archivos en `__tests__/utils/`, `__tests__/services/`, etc., espejando la estructura del proyecto
- Mocks de Supabase en `__mocks__/@supabase/`
- Las funciones puras de `utils/` (teamBalance, positions, date) tienen 100% de cobertura
