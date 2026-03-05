import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blink } from '@/lib/blink'
import { useAuth } from '@/hooks/useAuth'
import type { Player, Match, MatchPlayer, MatchType, Position } from '@/types'
import { MATCH_TYPE_LIMITS } from '@/types'

const POSITIONS_INFO: Record<string, { emoji: string; color: string }> = {
  POR: { emoji: '🧤', color: '#F59E0B' },
  DEF: { emoji: '🛡️', color: '#3B82F6' },
  MD: { emoji: '🎯', color: '#8B5CF6' },
  AT: { emoji: '⚡', color: '#EF4444' },
}

function balanceTeams(players: Player[]): { teamA: Player[]; teamB: Player[] } {
  const sorted = [...players].sort((a, b) => b.skill - a.skill)
  const teamA: Player[] = []
  const teamB: Player[] = []
  let sumA = 0, sumB = 0
  for (const p of sorted) {
    if (sumA <= sumB) { teamA.push(p); sumA += p.skill }
    else { teamB.push(p); sumB += p.skill }
  }
  return { teamA, teamB }
}

function avgSkill(players: Player[]) {
  if (!players.length) return '0.0'
  return (players.reduce((a, p) => a + p.skill, 0) / players.length).toFixed(1)
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${d} ${months[parseInt(m) - 1]} ${y}`
}

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([])
  const [localTeamA, setLocalTeamA] = useState<Player[]>([])
  const [localTeamB, setLocalTeamB] = useState<Player[]>([])
  const [saving, setSaving] = useState(false)

  // Fetch match
  const { data: match } = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const res = await blink.db.matches.get(matchId!)
      return res as Match
    },
    enabled: !!matchId,
  })

  // Fetch match players (with player info)
  const { data: matchPlayersRaw = [] } = useQuery({
    queryKey: ['matchPlayers', matchId],
    queryFn: async () => {
      const res = await blink.db.matchPlayers.list({ where: { matchId: matchId! } })
      return res as MatchPlayer[]
    },
    enabled: !!matchId,
  })

  // Fetch all available players
  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players', user?.id],
    queryFn: async () => {
      if (!user) return []
      const res = await blink.db.players.list({ where: { userId: user.id }, orderBy: { name: 'asc' } })
      return res as Player[]
    },
    enabled: !!user,
  })

  // Build team data from match players + all players
  const teamAPlayers: Player[] = matchPlayersRaw
    .filter((mp) => mp.team === 'A')
    .map((mp) => allPlayers.find((p) => p.id === mp.playerId))
    .filter(Boolean) as Player[]

  const teamBPlayers: Player[] = matchPlayersRaw
    .filter((mp) => mp.team === 'B')
    .map((mp) => allPlayers.find((p) => p.id === mp.playerId))
    .filter(Boolean) as Player[]

  const currentPlayerIds = matchPlayersRaw.map((mp) => mp.playerId)

  const limit = match ? MATCH_TYPE_LIMITS[match.matchType as MatchType] : 5

  useEffect(() => {
    if (teamAPlayers.length) setLocalTeamA(teamAPlayers)
    if (teamBPlayers.length) setLocalTeamB(teamBPlayers)
  }, [matchPlayersRaw.length])

  const openPlayerPicker = () => {
    setTempSelectedIds(currentPlayerIds)
    setShowPlayerPicker(true)
  }

  const toggleTempPlayer = (playerId: string) => {
    setTempSelectedIds((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId)
      if (prev.length >= limit * 2) return prev
      return [...prev, playerId]
    })
  }

  const handleApplyNewPlayers = () => {
    if (tempSelectedIds.length !== limit * 2) {
      Alert.alert('Error', `Necesitas ${limit * 2} jugadores.`)
      return
    }
    const selected = allPlayers.filter((p) => tempSelectedIds.includes(p.id))
    const { teamA, teamB } = balanceTeams(selected)
    setLocalTeamA(teamA)
    setLocalTeamB(teamB)
    setShowPlayerPicker(false)
  }

  const handleRedoTeams = () => {
    const allCurrent = [...localTeamA, ...localTeamB]
    const { teamA, teamB } = balanceTeams(allCurrent)
    setLocalTeamA(teamA)
    setLocalTeamB(teamB)
  }

  const handleSaveChanges = async () => {
    if (!matchId || !user) return
    setSaving(true)
    try {
      // Delete existing match players
      for (const mp of matchPlayersRaw) {
        await blink.db.matchPlayers.delete(mp.id)
      }
      // Create new ones
      for (const p of localTeamA) {
        await blink.db.matchPlayers.create({
          id: `mp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          matchId: matchId!,
          playerId: p.id,
          team: 'A',
          createdAt: new Date().toISOString(),
        })
      }
      for (const p of localTeamB) {
        await blink.db.matchPlayers.create({
          id: `mp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          matchId: matchId!,
          playerId: p.id,
          team: 'B',
          createdAt: new Date().toISOString(),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['matchPlayers', matchId] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      Alert.alert('¡Guardado!', 'El partido ha sido actualizado. 🎉')
    } catch (err: any) {
      Alert.alert('Error', err?.message)
    } finally {
      setSaving(false)
    }
  }

  if (!match) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#6B7280' }}>Cargando...</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#4ADE80" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{match.matchType.toUpperCase()}</Text>
            <Text style={styles.headerSub}>{formatDate(match.date)}</Text>
          </View>
          <TouchableOpacity style={styles.redoBtn} onPress={handleRedoTeams}>
            <Ionicons name="shuffle-outline" size={20} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Team A */}
          <View style={[styles.teamCard, styles.teamCardA]}>
            <View style={styles.teamHeader}>
              <Text style={styles.teamHeaderText}>🔴 EQUIPO A</Text>
              <Text style={styles.teamAvg}>Media: {avgSkill(localTeamA)}</Text>
            </View>
            {localTeamA.map((p) => {
              const pos = p.position ? POSITIONS_INFO[p.position] : null
              return (
                <View key={p.id} style={styles.playerRow}>
                  <Text style={{ fontSize: 18, marginRight: 10 }}>{pos ? pos.emoji : '⚽'}</Text>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Text key={i} style={{ fontSize: 12, color: i <= p.skill ? '#F59E0B' : '#374151' }}>★</Text>
                    ))}
                  </View>
                </View>
              )
            })}
          </View>

          {/* VS */}
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
              <Text style={styles.teamAvg}>Media: {avgSkill(localTeamB)}</Text>
            </View>
            {localTeamB.map((p) => {
              const pos = p.position ? POSITIONS_INFO[p.position] : null
              return (
                <View key={p.id} style={styles.playerRow}>
                  <Text style={{ fontSize: 18, marginRight: 10 }}>{pos ? pos.emoji : '⚽'}</Text>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Text key={i} style={{ fontSize: 12, color: i <= p.skill ? '#F59E0B' : '#374151' }}>★</Text>
                    ))}
                  </View>
                </View>
              )
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.changePlayersBtn} onPress={openPlayerPicker}>
              <Ionicons name="people-outline" size={18} color="#4ADE80" />
              <Text style={styles.changePlayersBtnText}>Cambiar jugadores</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.redoBtnLarge} onPress={handleRedoTeams}>
              <Ionicons name="shuffle-outline" size={18} color="#A78BFA" />
              <Text style={styles.redoBtnText}>Rehacer equipos</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveChanges}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle-outline" size={22} color="#0A3A17" />
            <Text style={styles.saveBtnText}>
              {saving ? 'Guardando...' : '💾 Guardar cambios'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Player Picker Modal */}
        <Modal visible={showPlayerPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>👥 Cambiar jugadores</Text>
                <TouchableOpacity onPress={() => setShowPlayerPicker(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSub}>
                Selecciona {limit * 2} jugadores ({tempSelectedIds.length}/{limit * 2})
              </Text>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {allPlayers.map((player) => {
                  const isSelected = tempSelectedIds.includes(player.id)
                  const pos = player.position ? POSITIONS_INFO[player.position] : null
                  return (
                    <TouchableOpacity
                      key={player.id}
                      style={[styles.modalPlayerRow, isSelected && styles.modalPlayerRowActive]}
                      onPress={() => toggleTempPlayer(player.id)}
                    >
                      <View style={[styles.playerCheck, isSelected && styles.playerCheckActive]}>
                        {isSelected && <Ionicons name="checkmark" size={12} color="#FFF" />}
                      </View>
                      <Text style={{ fontSize: 18, marginRight: 8 }}>{pos ? pos.emoji : '⚽'}</Text>
                      <Text style={[styles.modalPlayerName, isSelected && { color: '#4ADE80' }]}>
                        {player.name}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 1 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Text key={i} style={{ fontSize: 11, color: i <= player.skill ? '#F59E0B' : '#374151' }}>★</Text>
                        ))}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
              <TouchableOpacity
                style={[
                  styles.applyBtn,
                  tempSelectedIds.length !== limit * 2 && styles.applyBtnDisabled,
                ]}
                onPress={handleApplyNewPlayers}
                disabled={tempSelectedIds.length !== limit * 2}
              >
                <Text style={styles.applyBtnText}>Aplicar y rehacer equipos</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  teamCard: {
    backgroundColor: '#111827', borderRadius: 16, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  teamCardA: { borderTopWidth: 3, borderTopColor: '#EF4444' },
  teamCardB: { borderTopWidth: 3, borderTopColor: '#3B82F6' },
  teamHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 14, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  teamHeaderText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  teamAvg: { fontSize: 13, color: '#F59E0B', fontWeight: '700' },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  playerName: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  vsDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  vsLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  vsCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#166534', justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 12, borderWidth: 2, borderColor: '#22C55E',
  },
  vsText: { fontSize: 11, fontWeight: '900', color: '#22C55E' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 12 },
  changePlayersBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderRadius: 12, height: 46,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)',
  },
  changePlayersBtnText: { fontSize: 13, fontWeight: '700', color: '#4ADE80' },
  redoBtnLarge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderRadius: 12, height: 46,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
  },
  redoBtnText: { fontSize: 13, fontWeight: '700', color: '#A78BFA' },
  saveBtn: {
    backgroundColor: '#22C55E', borderRadius: 14, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#0A3A17' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '80%',
    borderTopWidth: 1, borderColor: 'rgba(74,222,128,0.15)',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 14 },
  modalScroll: { maxHeight: 320 },
  modalPlayerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A2E', borderRadius: 10, padding: 10, marginBottom: 6,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)',
  },
  modalPlayerRowActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)' },
  playerCheck: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#374151',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  playerCheckActive: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  modalPlayerName: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  applyBtn: {
    backgroundColor: '#22C55E', borderRadius: 12, height: 48,
    justifyContent: 'center', alignItems: 'center', marginTop: 14,
  },
  applyBtnDisabled: { opacity: 0.4 },
  applyBtnText: { fontSize: 15, fontWeight: '800', color: '#0A3A17' },
})
