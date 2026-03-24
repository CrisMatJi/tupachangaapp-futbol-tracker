---
applyTo: "app/**/*.tsx"
---

# Instrucciones para pantallas (app/)

## Estructura de una pantalla nueva

```tsx
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ImageBackground } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'

export default function MiPantalla() {
  const { user } = useAuth()
  // ...
  return (
    <ImageBackground source={require('@/assets/images/background-partidos.jpg')} style={styles.root} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* contenido */}
      </SafeAreaView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,22,40,0.82)' },
  safe: { flex: 1 },
})
```

## Reglas obligatorias

- **SafeAreaView** siempre con `edges={['top', 'bottom']}` de `react-native-safe-area-context`
- **Estilos** con `StyleSheet.create()` puro — NO Tailwind/NativeWind
- **Supabase nunca inline** — importar de `services/players.ts` o `services/matches.ts`
- **Auth** con `useAuth()` — nunca `supabase.auth` directamente en pantalla
- **NUNCA emoji en `<Text>`** — usar `MaterialCommunityIcons` o `Ionicons`
- **NUNCA emoji en `Alert.alert()`** — texto plano únicamente

## Iconos

```tsx
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Ionicons } from '@expo/vector-icons'

// MCIcons → fútbol / temático
<MaterialCommunityIcons name="soccer" size={24} color="#22C55E" />
<MaterialCommunityIcons name={(pos ? pos.iconName : 'soccer') as any} size={18} color={pos?.color ?? '#4ADE80'} />

// Ionicons → navegación / UI
<Ionicons name="arrow-back" size={22} color="#4ADE80" />
<Ionicons name="close" size={24} color="#C4C4C4" />
```

### MCIcons: posiciones
| key | iconName | color |
|---|---|---|
| POR | `handball` | `#F59E0B` |
| DEF | `shield-half-full` | `#3B82F6` |
| MD | `run-fast` | `#8B5CF6` |
| AT | `soccer` | `#EF4444` |

### MCIcons: tipos de partido
| matchType | iconName |
|---|---|
| 5v5 | `soccer` |
| 6v6 | `whistle-outline` |
| 7v7 | `trophy-outline` |
| 11v11 | `soccer-field` |

## Colores del tema
```ts
const COLORS = {
  bg:       '#0A1628',
  bgAlt:    '#0F1B2D',
  green:    '#22C55E',
  greenLight: '#4ADE80',
  teamA:    '#EF4444',
  teamB:    '#3B82F6',
  text:     '#FFFFFF',
  textSub:  '#D1D5DB',
  textMuted:'#9CA3AF',
}
```

## Data fetching (React Query v5)

```tsx
// Query
const { data: players, isLoading } = useQuery({
  queryKey: ['players', user?.id],
  queryFn: () => fetchPlayersByName(user!.id),
  enabled: !!user,
})

// Mutation con invalidación
const { mutate, isPending } = useMutation({
  mutationFn: createPlayer,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
})
```

## Navegación (expo-router)
```tsx
router.back()
router.push('/create-player')
router.replace('/home')
// Parámetros
router.push({ pathname: '/match-detail', params: { matchId: id } })
const { matchId } = useLocalSearchParams<{ matchId: string }>()
```

## Posiciones (lookup rápido)
```tsx
import { POSITIONS, POSITIONS_INFO, getPositionInfo } from '@/utils/positions'

// En un map de jugadores:
const pos = player.position ? POSITIONS_INFO[player.position] : null
<MaterialCommunityIcons name={(pos?.iconName ?? 'soccer') as any} size={18} color={pos?.color ?? '#4ADE80'} />
```

## Balance de equipos
```tsx
import { balanceTeams } from '@/utils/teamBalance'
// Cada llamada produce una distribución distinta (shuffle interno por skill)
const { teamA, teamB } = balanceTeams(selectedPlayers)
```
