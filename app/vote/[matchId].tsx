import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { POSITIONS_INFO } from '@/utils/positions'

type PlayerEntry = {
  id: string
  name: string
  team: 'A' | 'B'
  position?: string
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d} ${months[parseInt(m) - 1]} ${y}`
}

export default function VotePage() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>()

  const [matchInfo, setMatchInfo] = useState<{ date: string; matchType: string } | null>(null)
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [alreadyVoted, setAlreadyVoted] = useState(false)

  useEffect(() => {
    if (!matchId) return
    // Comprobar voto previo (localStorage en web)
    try {
      if (typeof window !== 'undefined' && window.localStorage.getItem(`voted_${matchId}`)) {
        setAlreadyVoted(true)
      }
    } catch {}
    loadData()
  }, [matchId])

  const loadData = async () => {
    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('date, match_type')
        .eq('id', matchId)
        .single()
      if (matchError) {
        // PGRST116 = no rows found; any "no rows" variant → show not-found screen
        if (matchError.code === 'PGRST116' || matchError.message?.toLowerCase().includes('0 rows') || matchError.message?.toLowerCase().includes('single')) {
          setNotFound(true)
          return
        }
        throw matchError
      }
      setMatchInfo({ date: matchData.date, matchType: matchData.match_type })

      const { data: mpData, error: mpError } = await supabase
        .from('match_players')
        .select('player_id, team')
        .eq('match_id', matchId)
      if (mpError) throw mpError
      if (!mpData || mpData.length === 0) { setPlayers([]); return }

      const playerIds = mpData.map((mp: any) => mp.player_id)
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name, position')
        .in('id', playerIds)
      if (playersError) throw playersError

      const playerMap = Object.fromEntries((playersData ?? []).map((p: any) => [p.id, p]))
      setPlayers((mpData ?? []).map((mp: any) => ({
        id: mp.player_id,
        name: playerMap[mp.player_id]?.name ?? 'Jugador',
        team: mp.team,
        position: playerMap[mp.player_id]?.position,
      })))
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar el partido')
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async () => {
    if (!selectedId || !matchId) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('votes').insert({
        match_id: matchId,
        player_id: selectedId,
      })
      if (error) throw error
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(`voted_${matchId}`, selectedId)
      } catch {}
      setDone(true)
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo registrar el voto')
    } finally {
      setSubmitting(false)
    }
  }

  const teamA = players.filter((p) => p.team === 'A')
  const teamB = players.filter((p) => p.team === 'B')
  const selectedPlayer = players.find((p) => p.id === selectedId)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Cargando partido...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  if (notFound) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="lock-outline" size={64} color="#D1D5DB" style={{ marginBottom: 12 }} />
        <Text style={styles.doneTitle}>Votación no disponible</Text>
        <Text style={styles.doneSubtitle}>
          Este enlace no corresponde a ningún partido activo o la votación ya ha finalizado.
        </Text>
        <Text style={styles.doneFooter}>tuPachanga</Text>
      </View>
    )
  }

  if (alreadyVoted || done) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="star-circle" size={64} color="#F59E0B" style={{ marginBottom: 12 }} />
        <Text style={styles.doneTitle}>¡Gracias por votar!</Text>
        {done && selectedPlayer && (
          <Text style={styles.doneSubtitle}>
            Votaste por{' '}
            <Text style={styles.donePlayerName}>{selectedPlayer.name}</Text>
          </Text>
        )}
        {alreadyVoted && !done && (
          <Text style={styles.doneSubtitle}>Ya has votado en este partido.</Text>
        )}
        <Text style={styles.doneFooter}>tuPachanga</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="soccer" size={48} color="#4ADE80" style={{ marginBottom: 8 }} />
        <Text style={styles.headerTitle}>tuPachanga</Text>
        <Text style={styles.headerSub}>Vota al MVP del partido</Text>
        {matchInfo && (
          <Text style={styles.matchInfo}>
            {formatDate(matchInfo.date)} · {matchInfo.matchType.toUpperCase()}
          </Text>
        )}
      </View>

      <Text style={styles.instruction}>
        Elige el jugador que mejor lo hizo en este partido
      </Text>

      {/* Equipo A */}
      <Text style={styles.teamLabelA}>EQUIPO A</Text>
      {teamA.map((p) => {
        const pos = POSITIONS_INFO[p.position ?? '']
        const isSelected = selectedId === p.id
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.playerCard, isSelected && styles.playerCardSelected]}
            onPress={() => setSelectedId(isSelected ? null : p.id)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={(pos ? pos.iconName : 'soccer') as any}
              size={22}
              color={pos ? pos.color : '#4ADE80'}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.playerName, isSelected && styles.playerNameSelected]}>
              {p.name}
            </Text>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        )
      })}

      {/* Equipo B */}
      <Text style={styles.teamLabelB}>EQUIPO B</Text>
      {teamB.map((p) => {
        const pos = POSITIONS_INFO[p.position ?? '']
        const isSelected = selectedId === p.id
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.playerCard, isSelected && styles.playerCardSelected]}
            onPress={() => setSelectedId(isSelected ? null : p.id)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={(pos ? pos.iconName : 'soccer') as any}
              size={22}
              color={pos ? pos.color : '#4ADE80'}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.playerName, isSelected && styles.playerNameSelected]}>
              {p.name}
            </Text>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        )
      })}

      {/* Botón votar */}
      <TouchableOpacity
        style={[styles.voteBtn, (!selectedId || submitting) && styles.voteBtnDisabled]}
        onPress={handleVote}
        disabled={!selectedId || submitting}
        activeOpacity={0.85}
      >
        <Text style={styles.voteBtnText}>
          {submitting
            ? 'Enviando...'
            : selectedId
            ? `Votar por ${selectedPlayer?.name}`
            : 'Selecciona un jugador'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Organizado con tuPachanga</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1628' },
  content: { padding: 20, paddingBottom: 60 },
  center: {
    flex: 1, backgroundColor: '#0A1628',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  loadingText: { color: '#D1D5DB', marginTop: 12, fontSize: 15 },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  errorText: { color: '#FCA5A5', textAlign: 'center', fontSize: 15 },
  header: { alignItems: 'center', marginBottom: 24 },
  headerBall: { fontSize: 48, marginBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#4ADE80', fontWeight: '600', marginTop: 4 },
  matchInfo: { fontSize: 13, color: '#9CA3AF', marginTop: 6 },
  instruction: { fontSize: 14, color: '#D1D5DB', textAlign: 'center', marginBottom: 20 },
  teamLabelA: {
    fontSize: 12, fontWeight: '800', color: '#EF4444',
    letterSpacing: 1, marginBottom: 8, marginTop: 4,
  },
  teamLabelB: {
    fontSize: 12, fontWeight: '800', color: '#3B82F6',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  playerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A2234', borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
  },
  playerCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  playerEmoji: { fontSize: 22, marginRight: 12 },
  playerName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#F3F4F6' },
  playerNameSelected: { color: '#F59E0B' },
  checkmark: { fontSize: 20, color: '#F59E0B', fontWeight: '900' },
  voteBtn: {
    backgroundColor: '#22C55E', borderRadius: 14,
    height: 56, justifyContent: 'center', alignItems: 'center',
    marginTop: 24, marginBottom: 8,
  },
  voteBtnDisabled: { opacity: 0.4 },
  voteBtnText: { fontSize: 16, fontWeight: '800', color: '#0A3A17' },
  footer: { textAlign: 'center', color: '#4B5563', fontSize: 12, marginTop: 20 },
  doneTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
  doneSubtitle: { fontSize: 15, color: '#D1D5DB', textAlign: 'center' },
  donePlayerName: { color: '#F59E0B', fontWeight: '800' },
  doneFooter: { color: '#4B5563', fontSize: 13, marginTop: 24 },
})
