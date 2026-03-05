import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blink } from '@/lib/blink'
import { useAuth } from '@/hooks/useAuth'
import type { Player, MatchType, Position } from '@/types'
import { MATCH_TYPE_LIMITS } from '@/types'

const MATCH_TYPES: { key: MatchType; label: string; emoji: string; total: number }[] = [
  { key: '5v5', label: '5 contra 5', emoji: '🥅', total: 10 },
  { key: '6v6', label: '6 contra 6', emoji: '⚡', total: 12 },
  { key: '7v7', label: '7 contra 7', emoji: '🏆', total: 14 },
  { key: '11v11', label: '11 contra 11', emoji: '🌟', total: 22 },
]

const POSITIONS_INFO: Record<string, { emoji: string; color: string }> = {
  POR: { emoji: '🧤', color: '#F59E0B' },
  DEF: { emoji: '🛡️', color: '#3B82F6' },
  MD: { emoji: '🎯', color: '#8B5CF6' },
  AT: { emoji: '⚡', color: '#EF4444' },
}

function balanceTeams(players: Player[]): { teamA: Player[]; teamB: Player[] } {
  // Sort by skill descending
  const sorted = [...players].sort((a, b) => b.skill - a.skill)
  const teamA: Player[] = []
  const teamB: Player[] = []
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
  return { teamA, teamB }
}

function avgSkill(players: Player[]) {
  if (!players.length) return 0
  return (players.reduce((acc, p) => acc + p.skill, 0) / players.length).toFixed(1)
}

export default function CreateMatchScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<'setup' | 'players' | 'teams'>('setup')
  const [matchType, setMatchType] = useState<MatchType>('5v5')
  const [date, setDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<{ teamA: Player[]; teamB: Player[] } | null>(null)
  const [saving, setSaving] = useState(false)

  const limit = MATCH_TYPE_LIMITS[matchType]

  const { data: players = [] } = useQuery({
    queryKey: ['players', user?.id],
    queryFn: async () => {
      if (!user) return []
      const res = await blink.db.players.list({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      })
      return res as Player[]
    },
    enabled: !!user,
  })

  const togglePlayer = (player: Player) => {
    const isSelected = selectedPlayers.some((p) => p.id === player.id)
    if (isSelected) {
      setSelectedPlayers((prev) => prev.filter((p) => p.id !== player.id))
    } else {
      if (selectedPlayers.length >= limit * 2) {
        Alert.alert('Límite alcanzado', `Para un ${matchType} necesitas exactamente ${limit * 2} jugadores.`)
        return
      }
      setSelectedPlayers((prev) => [...prev, player])
    }
  }

  const handleMakeTeams = () => {
    if (selectedPlayers.length !== limit * 2) {
      Alert.alert('Jugadores insuficientes', `Necesitas ${limit * 2} jugadores para un ${matchType}.\nActualmente tienes ${selectedPlayers.length}.`)
      return
    }
    const result = balanceTeams(selectedPlayers)
    setTeams(result)
    setStep('teams')
  }

  const handleSaveMatch = async () => {
    if (!user || !teams) return
    setSaving(true)
    try {
      const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      await blink.db.matches.create({
        id: matchId,
        userId: user.id,
        date,
        matchType,
        status: 'created',
        createdAt: new Date().toISOString(),
      })
      const allPlayers = [
        ...teams.teamA.map((p) => ({ playerId: p.id, team: 'A' })),
        ...teams.teamB.map((p) => ({ playerId: p.id, team: 'B' })),
      ]
      for (const mp of allPlayers) {
        await blink.db.matchPlayers.create({
          id: `mp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          matchId,
          playerId: mp.playerId,
          team: mp.team,
          createdAt: new Date().toISOString(),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      Alert.alert('¡Partido creado!', '🏆 ¡El partido ha sido guardado!', [
        { text: 'Ver partidos', onPress: () => router.replace('/matches-list') },
        { text: 'Nuevo partido', onPress: () => router.replace('/create-match') },
      ])
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar el partido.')
    } finally {
      setSaving(false)
    }
  }

  const handleRedoTeams = () => {
    const result = balanceTeams(selectedPlayers)
    setTeams(result)
  }

  // STEP: SETUP
  if (step === 'setup') {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#4ADE80" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>🏆 Nuevo Partido</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Date */}
            <Text style={styles.sectionLabel}>📅 Fecha del partido</Text>
            <View style={styles.dateCard}>
              <Ionicons name="calendar-outline" size={20} color="#4ADE80" />
              <Text style={styles.dateText}>{date}</Text>
              <View style={styles.dateControls}>
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(date)
                    d.setDate(d.getDate() - 1)
                    setDate(d.toISOString().split('T')[0])
                  }}
                  style={styles.dateBtnSmall}
                >
                  <Ionicons name="chevron-back" size={16} color="#4ADE80" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setDate(new Date().toISOString().split('T')[0])}
                  style={styles.todayBtn}
                >
                  <Text style={styles.todayBtnText}>Hoy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(date)
                    d.setDate(d.getDate() + 1)
                    setDate(d.toISOString().split('T')[0])
                  }}
                  style={styles.dateBtnSmall}
                >
                  <Ionicons name="chevron-forward" size={16} color="#4ADE80" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Match Type */}
            <Text style={styles.sectionLabel}>⚽ Tipo de partido</Text>
            <View style={styles.typeGrid}>
              {MATCH_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt.key}
                  style={[styles.typeCard, matchType === mt.key && styles.typeCardActive]}
                  onPress={() => { setMatchType(mt.key); setSelectedPlayers([]) }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeEmoji}>{mt.emoji}</Text>
                  <Text style={[styles.typeKey, matchType === mt.key && styles.typeKeyActive]}>
                    {mt.key}
                  </Text>
                  <Text style={styles.typeLabel}>{mt.label}</Text>
                  <Text style={styles.typeTotal}>{mt.total} jugadores</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => setStep('players')}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Seleccionar jugadores →</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    )
  }

  // STEP: PLAYERS
  if (step === 'players') {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('setup')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#4ADE80" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>👥 Elegir Jugadores</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.counterBar}>
            <Text style={styles.counterText}>
              {selectedPlayers.length} / {limit * 2} jugadores
            </Text>
            <View style={styles.progressWrap}>
              <View
                style={[styles.progressBar, { width: `${(selectedPlayers.length / (limit * 2)) * 100}%` }]}
              />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.playerList} showsVerticalScrollIndicator={false}>
            {players.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>⚽</Text>
                <Text style={styles.emptyText}>No tienes jugadores.\n¡Crea jugadores primero!</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/create-player')}>
                  <Text style={styles.emptyBtnText}>Crear jugador</Text>
                </TouchableOpacity>
              </View>
            ) : (
              players.map((player) => {
                const isSelected = selectedPlayers.some((p) => p.id === player.id)
                const pos = player.position ? POSITIONS_INFO[player.position] : null
                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[styles.playerRow, isSelected && styles.playerRowSelected]}
                    onPress={() => togglePlayer(player)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.playerCheck, isSelected && styles.playerCheckActive]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <View style={styles.playerAvatarSmall}>
                      <Text style={{ fontSize: 18 }}>{pos ? pos.emoji : '⚽'}</Text>
                    </View>
                    <View style={styles.playerInfo2}>
                      <Text style={[styles.playerName, isSelected && { color: '#4ADE80' }]}>
                        {player.name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Text key={i} style={{ fontSize: 11, color: i <= player.skill ? '#F59E0B' : '#374151' }}>★</Text>
                        ))}
                        {player.position && (
                          <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 4 }}>{player.position}</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })
            )}
          </ScrollView>

          {selectedPlayers.length === limit * 2 && (
            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.teamBtn} onPress={handleMakeTeams} activeOpacity={0.85}>
                <Ionicons name="shuffle-outline" size={22} color="#0A3A17" />
                <Text style={styles.teamBtnText}>¡Hacer equipos equilibrados!</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </View>
    )
  }

  // STEP: TEAMS
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('players')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#4ADE80" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🏆 Equipos</Text>
          <TouchableOpacity style={styles.redoBtn} onPress={handleRedoTeams}>
            <Ionicons name="shuffle-outline" size={20} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.teamsContainer}>
            {/* Team A */}
            <View style={[styles.teamCard, styles.teamCardA]}>
              <View style={styles.teamHeader}>
                <Text style={styles.teamHeaderText}>🔴 EQUIPO A</Text>
                <Text style={styles.teamAvg}>Media: {avgSkill(teams?.teamA || [])}</Text>
              </View>
              {teams?.teamA.map((p) => {
                const pos = p.position ? POSITIONS_INFO[p.position] : null
                return (
                  <View key={p.id} style={styles.teamPlayerRow}>
                    <Text style={{ fontSize: 16, marginRight: 8 }}>{pos ? pos.emoji : '⚽'}</Text>
                    <Text style={styles.teamPlayerName}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 1 }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Text key={i} style={{ fontSize: 10, color: i <= p.skill ? '#F59E0B' : '#374151' }}>★</Text>
                      ))}
                    </View>
                  </View>
                )
              })}
            </View>

            {/* VS divider */}
            <View style={styles.vsDivider}>
              <View style={styles.vsLine} />
              <View style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <View style={styles.vsLine} />
            </View>

            {/* Team B */}
            <View style={[styles.teamCard, styles.teamCardB]}>
              <View style={styles.teamHeader}>
                <Text style={styles.teamHeaderText}>🔵 EQUIPO B</Text>
                <Text style={styles.teamAvg}>Media: {avgSkill(teams?.teamB || [])}</Text>
              </View>
              {teams?.teamB.map((p) => {
                const pos = p.position ? POSITIONS_INFO[p.position] : null
                return (
                  <View key={p.id} style={styles.teamPlayerRow}>
                    <Text style={{ fontSize: 16, marginRight: 8 }}>{pos ? pos.emoji : '⚽'}</Text>
                    <Text style={styles.teamPlayerName}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 1 }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Text key={i} style={{ fontSize: 10, color: i <= p.skill ? '#F59E0B' : '#374151' }}>★</Text>
                      ))}
                    </View>
                  </View>
                )
              })}
            </View>
          </View>

          {/* Info bar */}
          <View style={styles.infoBar}>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeLabel}>Partido</Text>
              <Text style={styles.infoBadgeValue}>{matchType}</Text>
            </View>
            <View style={styles.infoBadge}>
              <Text style={styles.infoBadgeLabel}>Fecha</Text>
              <Text style={styles.infoBadgeValue}>{date}</Text>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.redoBtnLarge} onPress={handleRedoTeams} activeOpacity={0.85}>
            <Ionicons name="shuffle-outline" size={20} color="#4ADE80" />
            <Text style={styles.redoBtnText}>Rehacer equipos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveMatchBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveMatch}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={22} color="#0A3A17" />
            <Text style={styles.saveMatchBtnText}>
              {saving ? 'Guardando...' : '💾 Guardar partido'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A3A17' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(74,222,128,0.1)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(74,222,128,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  redoBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(74,222,128,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  // Date
  dateCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 14, padding: 14,
    marginBottom: 20, gap: 10,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.15)',
  },
  dateText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  dateControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtnSmall: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  todayBtn: {
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: '#4ADE80' },
  // Type
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  typeCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#111827', borderRadius: 14,
    padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
  },
  typeCardActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.12)' },
  typeEmoji: { fontSize: 28, marginBottom: 6 },
  typeKey: { fontSize: 18, fontWeight: '900', color: '#6B7280', marginBottom: 2 },
  typeKeyActive: { color: '#22C55E' },
  typeLabel: { fontSize: 11, color: '#4B5563', marginBottom: 2 },
  typeTotal: { fontSize: 10, color: '#374151' },
  nextBtn: {
    backgroundColor: '#22C55E', borderRadius: 14, height: 54,
    justifyContent: 'center', alignItems: 'center',
  },
  nextBtnText: { fontSize: 16, fontWeight: '800', color: '#0A3A17' },
  // Counter
  counterBar: { paddingHorizontal: 16, paddingVertical: 10 },
  counterText: { fontSize: 13, color: '#4ADE80', fontWeight: '600', marginBottom: 6 },
  progressWrap: {
    height: 4, backgroundColor: '#1F2937', borderRadius: 2,
  },
  progressBar: {
    height: 4, backgroundColor: '#22C55E', borderRadius: 2,
  },
  // Player select
  playerList: { paddingHorizontal: 16, paddingBottom: 100 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 12, marginBottom: 8, padding: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
  },
  playerRowSelected: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.1)' },
  playerCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#374151',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  playerCheckActive: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  playerAvatarSmall: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#166534',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  playerInfo2: { flex: 1 },
  playerName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0A3A17',
    padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: 'rgba(74,222,128,0.15)',
  },
  teamBtn: {
    backgroundColor: '#22C55E', borderRadius: 14, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  teamBtnText: { fontSize: 15, fontWeight: '800', color: '#0A3A17' },
  // Teams
  teamsContainer: { gap: 12, marginBottom: 16 },
  teamCard: {
    backgroundColor: '#111827', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  teamCardA: { borderTopWidth: 3, borderTopColor: '#EF4444' },
  teamCardB: { borderTopWidth: 3, borderTopColor: '#3B82F6' },
  teamHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 14, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  teamHeaderText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  teamAvg: { fontSize: 13, color: '#F59E0B', fontWeight: '700' },
  teamPlayerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  teamPlayerName: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  vsDivider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 4,
  },
  vsLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  vsCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#166534', justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 12,
    borderWidth: 2, borderColor: '#22C55E',
  },
  vsText: { fontSize: 11, fontWeight: '900', color: '#22C55E' },
  infoBar: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  infoBadge: {
    flex: 1, backgroundColor: '#111827', borderRadius: 12, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  infoBadgeLabel: { fontSize: 10, color: '#6B7280', marginBottom: 2 },
  infoBadgeValue: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  redoBtnLarge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderRadius: 14, height: 48, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  redoBtnText: { fontSize: 14, fontWeight: '700', color: '#4ADE80' },
  saveMatchBtn: {
    backgroundColor: '#22C55E', borderRadius: 14, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveMatchBtnText: { fontSize: 16, fontWeight: '800', color: '#0A3A17' },
  saveBtnDisabled: { opacity: 0.6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#6B7280', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: 16, backgroundColor: '#22C55E',
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: '#0A3A17', fontWeight: '700' },
})
