# tuPachanga — Instrucciones para IA

App móvil para organizar pachangas de fútbol: crear jugadores, formar equipos equilibrados, registrar partidos y votar MVP. **React Native + Expo + Supabase.**

---

## Tech Stack

| Área | Tecnología |
|---|---|
| Framework | Expo SDK ~54.0.25, React Native 0.81.5 |
| Routing | expo-router ~6.0.15 (file-based, `app/` directory) |
| Lenguaje | TypeScript estricto |
| Backend | Supabase (PostgreSQL + Auth) |
| Data fetching | @tanstack/react-query v5 |
| Iconos | @expo/vector-icons (MaterialCommunityIcons + Ionicons) |
| Build/Deploy | EAS Build (Expo Application Services) |
| Tests | Jest 29.7.0 + jest-expo |

---

## Estructura del Proyecto

```
app/                   # Pantallas (expo-router)
  _layout.tsx          # Root layout con QueryClientProvider + useAuth guard
  index.tsx            # Splash animado (pelota rebotando)
  auth.tsx             # Login / Registro / Google OAuth
  home.tsx             # Menú principal
  create-player.tsx    # Crear jugador
  players-list.tsx     # Listado + edición de jugadores
  create-match.tsx     # Crear partido (3 pasos: config → jugadores → equipos)
  matches-list.tsx     # Historial de partidos
  match-detail.tsx     # Detalle: equipos, resultado, MVP, finalizar
  vote/[matchId].tsx   # Página web de votación MVP (acceso sin login)
components/
  ui/                  # Componentes genéricos (Button, Card, Input, Avatar, Container)
  FootballBackground.tsx
  RuleSection.tsx
services/              # Capa de acceso a Supabase (ÚNICA fuente de operaciones DB)
  players.ts           # CRUD jugadores
  matches.ts           # CRUD partidos + match_players
utils/
  positions.ts         # Definición centralizada de posiciones (POSITIONS, POSITIONS_INFO)
  teamBalance.ts       # Algoritmo balanceTeams() — pura, sin UI
  date.ts              # Helpers de fecha
hooks/
  useAuth.ts           # { user, loading, isAuthenticated }
  useFrameworkReady.ts
lib/
  supabase.ts          # Cliente Supabase
types/
  index.ts             # Player, Match, MatchPlayer, Position, MatchType, Team
constants/
  design.ts            # Tokens de diseño (colores, espaciado)
  animations.ts
  platform.ts
```

---

## Modelo de Datos (Supabase)

### Tabla `players`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | auth.users |
| name | text | |
| skill | int | 1–5 |
| position | text | NULL o 'POR'\|'DEF'\|'MD'\|'AT' |
| created_at | timestamptz | |

### Tabla `matches`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| date | date | YYYY-MM-DD |
| match_type | text | '5v5'\|'6v6'\|'7v7'\|'11v11' |
| status | text | 'created'\|'finished' |
| score_a | int | NULL hasta finalizar |
| score_b | int | NULL hasta finalizar |
| mvp_player_id | uuid FK | NULL hasta finalizar |
| created_at | timestamptz | |

### Tabla `match_players`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| match_id | uuid FK | |
| player_id | uuid FK | |
| user_id | uuid FK | |
| team | text | 'A'\|'B' |

---

## Patrones Clave

### Autenticación
```ts
// Siempre usar el hook, nunca supabase.auth directamente en pantallas
const { user, loading, isAuthenticated } = useAuth()
// OAuth Google → scheme: 'tupachangaapp', path: 'auth'
```

### Data fetching con React Query v5
```ts
// Query
const { data, isLoading } = useQuery({
  queryKey: ['players', user?.id],
  queryFn: () => fetchPlayersByName(user!.id),
  enabled: !!user,
})
// Mutation
const mutation = useMutation({
  mutationFn: createPlayer,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
})
```

### Servicios — nunca Supabase inline en pantallas
```ts
// CORRECTO: llamar a services/
import { fetchPlayersByName, createPlayer } from '@/services/players'
// INCORRECTO: supabase.from('players').select() dentro de un componente
```

### Posiciones
```ts
import { POSITIONS, POSITIONS_INFO, getPositionInfo } from '@/utils/positions'
// POSITIONS = array con { key, label, iconName, color }
// POSITIONS_INFO = Record<Position, { iconName, color }> para lookup rápido
// getPositionInfo(pos?) devuelve { iconName, color } | null
```

### Iconos — REGLAS CRÍTICAS
- **MaterialCommunityIcons** → iconos temáticos de fútbol y acciones principales
- **Ionicons** → navegación y UI genérica (arrow-back, close, calendar, search…)
- **NUNCA emoji en `<Text>`** — se renderizan como `[?]` en iOS/Android en algunos dispositivos
- Las cadenas de `Alert.alert()` tampoco deben contener emoji

#### Mapa de iconos MCIcons por posición
| Posición | iconName MCIcons | Color |
|---|---|---|
| POR Portero | `handball` | #F59E0B |
| DEF Defensa | `shield-half-full` | #3B82F6 |
| MD Mediocampista | `run-fast` | #8B5CF6 |
| AT Atacante | `soccer` | #EF4444 |

#### Otros iconos MCIcons en uso
| Contexto | iconName |
|---|---|
| Pelota / genérico | `soccer` |
| Campo / estado vacío | `soccer-field` |
| Partido 6v6 | `whistle-outline` |
| Partido 7v7 | `trophy-outline` |
| Trofeo / MVP | `trophy` |
| Crear Jugador (menú) | `account-plus-outline` |
| Partidos Existentes (menú) | `clipboard-list-outline` |
| Listado Jugadores (menú) | `account-group-outline` |
| Sin jugadores (vacío) | `account-group-outline` |
| Votación cerrada | `lock-outline` |
| Votación completada | `star-circle` |

---

## Diseño Visual

- **Fondo oscuro**: `#0A1628` / `#0F1B2D`
- **Verde principal**: `#22C55E` / `#4ADE80`
- **Equipo A**: `#EF4444` (rojo)
- **Equipo B**: `#3B82F6` (azul)
- **Texto**: `#FFFFFF` primario, `#D1D5DB` secundario, `#9CA3AF` muted
- **Estilos**: `StyleSheet.create()` puro — no Tailwind/NativeWind en pantallas
- **SafeAreaView**: siempre con `edges={['top', 'bottom']}` de `react-native-safe-area-context`
- **ImageBackground**: las pantallas principales usan fondos de fútbol (`background-partidos.jpg`)

---

## Build & Deploy

```bash
# Desarrollo
npm run start:ios       # Inicia en simulador iOS (ID hardcoded para el Mac dev)
npm run start:android   # Inicia en emulador Android

# Tests
npm test                # jest --watchAll=false

# EAS Builds
eas build --platform android --profile preview     # APK para instalar directamente
eas build --platform android --profile production  # AAB para Play Store
eas build --platform ios --profile production      # IPA para App Store

# Subida a Play Store
eas submit --platform android  # Requiere google-service-account.json
```

### Notas críticas de build
- Usar **npm** (no bun/yarn) para builds EAS
- `.npmrc` tiene `legacy-peer-deps=true` — NO eliminar
- `babel.config.js`: `api.cache(true)`, sin worklets plugin
- EAS project ID: `c9183ecb-9637-4b9e-b95a-d89f38721bdd`
- EAS owner: `@brumas/tupachangaapp`

---

## IDs y Configuración

| Config | Valor |
|---|---|
| App name | tuPachanga |
| Slug | tupachangaapp |
| Android package | `com.tupachangaapp` |
| iOS bundle ID | `com.tupachangaapp` |
| URL scheme | `tupachangaapp` |
| Supabase project | Ver `.env.local` (EXPO_PUBLIC_SUPABASE_URL / ANON_KEY) |
| Privacy policy | `https://tupachangaapp-5883.netlify.app/privacy-policy` |
| Contacto | tupachangaapp@gmail.com |

---

## Trabajo Pendiente (a fecha de creación)

- **Play Store**: subida en curso con `eas submit` tras build de producción EAS
- **Privacy policy Netlify**: deploy de `public/privacy-policy.html` en `https://tupachangaapp-5883.netlify.app/privacy-policy` (requerida por Play Store)
