import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Share,
  Linking,
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

function posImbalance(teamA: Player[], teamB: Player[]): number {
  return ['POR', 'DEF', 'MD', 'AT'].reduce((score, pos) => {
    const cA = teamA.filter(p => p.position === pos).length
    const cB = teamB.filter(p => p.position === pos).length
    return score + Math.abs(cA - cB)
  }, 0)
}

function balanceTeams(players: Player[]): { teamA: Player[]; teamB: Player[] } {
  const sorted = [...players].sort((a, b) => b.skill - a.skill)
  let teamA: Player[] = []
  let teamB: Player[] = []
  let sumA = 0, sumB = 0
  for (const p of sorted) {
    if (sumA <= sumB) { teamA.push(p); sumA += p.skill }
    else { teamB.push(p); sumB += p.skill }
  }
  // Intercambios de igual skill para mejorar balance de posiciones
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
          teamA = newA; teamB = newB; improved = true
        }
      }
    }
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
  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [mvpPlayerId, setMvpPlayerId] = useState<string | null>(null)

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

  // Cargar resultado y MVP si el partido ya está finalizado
  useEffect(() => {
    if (match) {
      if (match.scoreA !== undefined) setScoreA(match.scoreA)
      if (match.scoreB !== undefined) setScoreB(match.scoreB)
      if (match.mvpPlayerId) setMvpPlayerId(match.mvpPlayerId)
    }
  }, [match?.id])

  const handleFinishMatch = async () => {
    if (!matchId || !user) return
    Alert.alert(
      'Finalizar partido',
      `¿Confirmas el resultado ${scoreA} - ${scoreB}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            setSaving(true)
            try {
              await blink.db.matches.update(matchId, {
                status: 'finished',
                scoreA,
                scoreB,
                mvpPlayerId: mvpPlayerId || undefined,
              } as any)
              queryClient.invalidateQueries({ queryKey: ['match', matchId] })
              queryClient.invalidateQueries({ queryKey: ['matches'] })
              Alert.alert('¡Partido finalizado!', '🏆 El resultado ha sido guardado.')
            } catch (err: any) {
              console.error('[match-detail] Error finalizando partido:', JSON.stringify(err, null, 2))
              Alert.alert('Error', err?.message || 'No se pudo finalizar el partido.\nRevisa que la tabla \'matches\' tiene los campos: status, score_a, score_b, mvp_player_id.')
            } finally {
              setSaving(false)
            }
          },
        },
      ]
    )
  }

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

  const formatLineup = (): string => {
    const stars = (n: number) => '⭐'.repeat(n)
    const teamAText = localTeamA
      .map(p => `  ${POSITIONS_INFO[p.position || '']?.emoji ?? '⚽'} ${p.name}  ${stars(p.skill)}`)
      .join('\n')
    const teamBText = localTeamB
      .map(p => `  ${POSITIONS_INFO[p.position || '']?.emoji ?? '⚽'} ${p.name}  ${stars(p.skill)}`)
      .join('\n')
    const dateStr = match ? formatDate(match.date) : ''
    const type = match?.matchType?.toUpperCase() ?? ''
    return `⚽ *tuPachanga — Alineación*\n📅 ${dateStr}  ·  ${type}\n\n🔴 *EQUIPO A* (Media ${avgSkill(localTeamA)}★)\n${teamAText}\n\n🔵 *EQUIPO B* (Media ${avgSkill(localTeamB)}★)\n${teamBText}\n\n🏆 Organizado con tuPachanga`
  }

  const handleShareLineup = async () => {
    try { await Share.share({ message: formatLineup() }) } catch {}
  }

  const handleShareWhatsApp = async () => {
    const text = formatLineup()
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url)
    } else {
      await Share.share({ message: text })
    }
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
      for (let i = 0; i < localTeamA.length; i++) {
        await blink.db.matchPlayers.create({
          id: `mp_${matchId}_A_${i}`,
          matchId: matchId!,
          playerId: localTeamA[i].id,
          team: 'A',
          userId: user.id,
          createdAt: new Date().toISOString(),
        })
      }
      for (let i = 0; i < localTeamB.length; i++) {
        await blink.db.matchPlayers.create({
          id: `mp_${matchId}_B_${i}`,
          matchId: matchId!,
          playerId: localTeamB[i].id,
          team: 'B',
          userId: user.id,
          createdAt: new Date().toISOString(),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['matchPlayers', matchId] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      Alert.alert('¡Guardado!', 'El partido ha sido actualizado. 🎉')
    } catch (err: any) {
      console.error('[match-detail] Error guardando cambios:', JSON.stringify(err, null, 2))
      Alert.alert('Error', err?.message || 'No se pudo guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  if (!match) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#D1D5DB' }}>Cargando...</Text>
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
          <TouchableOpacity style={styles.redoBtn} onPress={handleShareLineup} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={22} color="#4ADE80" />
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

          {/* ── Resultado y MVP ── */}
          {match.status === 'finished' ? (
            <View style={styles.resultBanner}>
              <Text style={styles.resultTitle}>🏆 Resultado final</Text>
              <View style={styles.resultScoreRow}>
                <Text style={styles.resultTeamLabel}>🔴 A</Text>
                <Text style={styles.resultScoreNum}>{match.scoreA ?? '–'}</Text>
                <Text style={styles.resultColon}>:</Text>
                <Text style={styles.resultScoreNum}>{match.scoreB ?? '–'}</Text>
                <Text style={[styles.resultTeamLabel, { color: '#3B82F6' }]}>🔵 B</Text>
              </View>
              {match.mvpPlayerId && (
                <View style={styles.mvpResultRow}>
                  <Text style={styles.mvpResultLabel}>⭐ MVP</Text>
                  <Text style={styles.mvpResultName}>
                    {allPlayers.find(p => p.id === match.mvpPlayerId)?.name || '–'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.finishSection}>
              <Text style={styles.finishSectionTitle}>🏁 Finalizar partido</Text>

              {/* Marcador */}
              <Text style={styles.finishLabel}>RESULTADO</Text>
              <View style={styles.scoreRow}>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreTeamLabel}>🔴 Equipo A</Text>
                  <View style={styles.scoreControls}>
                    <TouchableOpacity onPress={() => setScoreA(Math.max(0, scoreA - 1))} style={styles.scoreBtn}>
                      <Text style={styles.scoreBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.scoreValue}>{scoreA}</Text>
                    <TouchableOpacity onPress={() => setScoreA(scoreA + 1)} style={styles.scoreBtn}>
                      <Text style={styles.scoreBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.scoreSeparator}>
                  <Text style={styles.scoreSeparatorText}>:</Text>
                </View>
                <View style={styles.scoreBox}>
                  <Text style={[styles.scoreTeamLabel, { color: '#3B82F6' }]}>🔵 Equipo B</Text>
                  <View style={styles.scoreControls}>
                    <TouchableOpacity onPress={() => setScoreB(Math.max(0, scoreB - 1))} style={styles.scoreBtn}>
                      <Text style={styles.scoreBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.scoreValue}>{scoreB}</Text>
                    <TouchableOpacity onPress={() => setScoreB(scoreB + 1)} style={styles.scoreBtn}>
                      <Text style={styles.scoreBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* MVP */}
              <Text style={styles.finishLabel}>MVP DEL PARTIDO ⭐</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mvpScroll} contentContainerStyle={{ paddingRight: 16 }}>
                {[...localTeamA, ...localTeamB].map((p) => {
                  const isSelected = mvpPlayerId === p.id
                  const pos = p.position ? POSITIONS_INFO[p.position] : null
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.mvpCard, isSelected && styles.mvpCardActive]}
                      onPress={() => setMvpPlayerId(isSelected ? null : p.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.mvpEmoji}>{pos ? pos.emoji : '⚽'}</Text>
                      <Text style={[styles.mvpName, isSelected && styles.mvpNameActive]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {isSelected && <Text style={styles.mvpStar}>⭐</Text>}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.finishBtn, saving && styles.saveBtnDisabled]}
                onPress={handleFinishMatch}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Ionicons name="trophy-outline" size={20} color="#0A3A17" />
                <Text style={styles.finishBtnText}>{saving ? 'Guardando...' : '✅ Finalizar partido'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Player Picker Modal */}
        <Modal visible={showPlayerPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>👥 Cambiar jugadores</Text>
                <TouchableOpacity onPress={() => setShowPlayerPicker(false)}>
                  <Ionicons name="close" size={24} color="#C4C4C4" />
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
  headerSub: { fontSize: 13, color: '#D1D5DB', textAlign: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  teamCard: {
    backgroundColor: '#0D1F0D', borderRadius: 16, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.12)', overflow: 'hidden',
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
  playerName: { flex: 1, fontSize: 15, color: '#F3F4F6', fontWeight: '600' },
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
  modalSub: { fontSize: 13, color: '#D1D5DB', marginBottom: 14 },
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
  // Result banner (partido finalizado)
  resultBanner: {
    marginTop: 16, backgroundColor: '#1A2F1A',
    borderRadius: 16, padding: 20,
    borderWidth: 1.5, borderColor: '#22C55E',
    alignItems: 'center',
  },
  resultTitle: { fontSize: 16, fontWeight: '800', color: '#22C55E', marginBottom: 14 },
  resultScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  resultTeamLabel: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  resultScoreNum: { fontSize: 40, fontWeight: '900', color: '#FFFFFF' },
  resultColon: { fontSize: 34, fontWeight: '900', color: '#4ADE80' },
  mvpResultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  mvpResultLabel: { fontSize: 13, color: '#F59E0B', fontWeight: '700' },
  mvpResultName: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  // Finish section
  finishSection: {
    marginTop: 16, backgroundColor: '#111827',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
  },
  finishSectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 14 },
  finishLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase',
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  scoreBox: { flex: 1, alignItems: 'center' },
  scoreTeamLabel: { fontSize: 12, fontWeight: '700', color: '#EF4444', marginBottom: 8 },
  scoreControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.12)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  scoreBtnText: { fontSize: 22, fontWeight: '700', color: '#4ADE80', lineHeight: 26 },
  scoreValue: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', minWidth: 40, textAlign: 'center' },
  scoreSeparator: { paddingHorizontal: 8, alignItems: 'center' },
  scoreSeparatorText: { fontSize: 30, fontWeight: '900', color: '#4ADE80' },
  mvpScroll: { marginBottom: 16 },
  mvpCard: {
    width: 80, marginRight: 10,
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 10,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
  },
  mvpCardActive: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)' },
  mvpEmoji: { fontSize: 22, marginBottom: 4 },
  mvpName: { fontSize: 11, fontWeight: '600', color: '#D1D5DB', textAlign: 'center' },
  mvpNameActive: { color: '#F59E0B' },
  mvpStar: { fontSize: 14, marginTop: 2 },
  finishBtn: {
    backgroundColor: '#22C55E', borderRadius: 14, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  finishBtnText: { fontSize: 15, fontWeight: '800', color: '#0A3A17' },
  shareRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 10 },
  shareWhatsAppBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#25D366', borderRadius: 14, height: 50,
  },
  shareWhatsAppText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  shareOtherBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 14, height: 50,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  shareOtherText: { fontSize: 14, fontWeight: '700', color: '#4ADE80' },
})
