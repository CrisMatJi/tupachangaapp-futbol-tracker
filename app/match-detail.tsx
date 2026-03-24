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
  ImageBackground,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Player, Match, MatchPlayer, MatchType, Position } from '@/types'
import { MATCH_TYPE_LIMITS } from '@/types'
import { balanceTeams, avgSkill } from '@/utils/teamBalance'
import { POSITIONS_INFO, getPositionInfo } from '@/utils/positions'
import { formatDate } from '@/utils/date'


export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
  const [showEditResult, setShowEditResult] = useState(false)
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
      const { data, error } = await supabase
        .from('matches').select('*').eq('id', matchId!).single()
      if (error) throw error
      return {
        id: data.id, userId: data.user_id, date: data.date,
        matchType: data.match_type, status: data.status,
        scoreA: data.score_a, scoreB: data.score_b,
        mvpPlayerId: data.mvp_player_id, createdAt: data.created_at,
      } as Match
    },
    enabled: !!matchId,
  })

  // Fetch match players
  const { data: matchPlayersRaw = [] } = useQuery({
    queryKey: ['matchPlayers', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_players').select('*').eq('match_id', matchId!)
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id, matchId: r.match_id, playerId: r.player_id,
        userId: r.user_id, team: r.team, createdAt: r.created_at,
      })) as MatchPlayer[]
    },
    enabled: !!matchId,
  })

  // Fetch votes for this match
  const { data: votesData = [] } = useQuery({
    queryKey: ['votes', matchId],
    queryFn: async () => {
      if (!matchId) return []
      const { data, error } = await supabase
        .from('votes').select('player_id').eq('match_id', matchId)
      if (error) throw error
      return data ?? []
    },
    enabled: !!matchId,
    refetchInterval: 30000, // auto-refresh cada 30s
  })

  const voteCounts: Record<string, number> = votesData.reduce((acc: Record<string, number>, v: any) => {
    acc[v.player_id] = (acc[v.player_id] ?? 0) + 1
    return acc
  }, {})
  const totalVotes = votesData.length
  const topVotedId = totalVotes > 0
    ? Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null

  // Fetch all available players
  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('players').select('*').eq('user_id', user.id).order('name')
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id, userId: r.user_id, name: r.name,
        skill: r.skill, position: r.position, createdAt: r.created_at,
      })) as Player[]
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
  }, [matchPlayersRaw.length, allPlayers.length])

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
              const { error } = await supabase.from('matches').update({
                status: 'finished',
                score_a: scoreA,
                score_b: scoreB,
                mvp_player_id: mvpPlayerId || null,
              }).eq('id', matchId)
              if (error) throw error
              queryClient.invalidateQueries({ queryKey: ['match', matchId] })
              queryClient.invalidateQueries({ queryKey: ['matches'] })
              Alert.alert('¡Partido finalizado!', 'El resultado ha sido guardado.')
            } catch (err: any) {
              console.error('[match-detail] Error finalizando partido:', JSON.stringify(err, null, 2))
              Alert.alert('Error', err?.message || 'No se pudo finalizar el partido.')
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
    const teamAText = localTeamA
      .map(p => `  [${p.position ?? '?'}] ${p.name}`)
      .join('\n')
    const teamBText = localTeamB
      .map(p => `  [${p.position ?? '?'}] ${p.name}`)
      .join('\n')
    const dateStr = match ? formatDate(match.date) : ''
    const type = match?.matchType?.toUpperCase() ?? ''
    return `⚽ *tuPachanga — Alineación*\n📅 ${dateStr}  ·  ${type}\n\n🔴 *EQUIPO A*\n${teamAText}\n\n🔵 *EQUIPO B*\n${teamBText}\n\n🏆 Organizado con tuPachanga`
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

  // ── Votación MVP ──
  const NUMBER_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟',
    '11.','12.','13.','14.','15.','16.','17.','18.','19.','20.','21.','22.']

  const formatVoteMessage = (deadlineStr: string): string => {
    const dateStr = match ? formatDate(match.date) : ''
    const type = match?.matchType?.toUpperCase() ?? ''
    const teamALines = localTeamA.map((p, i) =>
      `${NUMBER_EMOJIS[i]} [${p.position ?? '?'}] ${p.name}`
    ).join('\n')
    const teamBLines = localTeamB.map((p, i) =>
      `${NUMBER_EMOJIS[localTeamA.length + i]} [${p.position ?? '?'}] ${p.name}`
    ).join('\n')
    return `⭐ *Vota al MVP de la pachanga*\n📅 ${dateStr}  ·  ${type}\n\nResponde con el número de tu jugador favorito 👇\n\n🔴 *EQUIPO A:*\n${teamALines}\n\n🔵 *EQUIPO B:*\n${teamBLines}\n\n⏰ ${deadlineStr}\n🏆 Organizado con tuPachanga`
  }

  const doShareVote = async (deadlineStr: string) => {
    const appUrl = process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:8081'
    const voteUrl = `${appUrl}/vote/${matchId}`
    const dateStr = match ? formatDate(match.date) : ''
    const type = match?.matchType?.toUpperCase() ?? ''
    const message = `⭐ *Vota al MVP de la pachanga*\n📅 ${dateStr} · ${type}\n\nAbre este enlace y elige tu MVP 👇\n${voteUrl}\n\n⏰ ${deadlineStr}\n🏆 tuPachanga`
    try { await Share.share({ message, url: voteUrl }) } catch {}
  }

  const handleShareVote = () => {
    const now = new Date()
    const fmt = (d: Date) =>
      `${d.getDate()} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]} a las ${String(d.getHours()).padStart(2,'0')}:00`
    const inTwoH = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const tonight = new Date(now); tonight.setHours(22, 0, 0, 0)
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(12, 0, 0, 0)
    Alert.alert('Abrir votación MVP', '¿Cuándo cierra la votación?', [
      { text: `En 2h  (${fmt(inTwoH)})`, onPress: () => doShareVote(`Votación abierta hasta el ${fmt(inTwoH)}`) },
      { text: `Esta noche  (${fmt(tonight)})`, onPress: () => doShareVote(`Votación abierta hasta el ${fmt(tonight)}`) },
      { text: `Mañana mediodía  (${fmt(tomorrow)})`, onPress: () => doShareVote(`Votación abierta hasta el ${fmt(tomorrow)}`) },
      { text: 'Sin límite', onPress: () => doShareVote('Votación abierta') },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  const handleSaveChanges = async () => {
    if (!matchId || !user) return
    setSaving(true)
    try {
      // Borrar match_players en bloque
      const { error: delError } = await supabase.from('match_players').delete().eq('match_id', matchId!)
      if (delError) throw delError

      // Insertar nuevos en bloque
      const rows = [
        ...localTeamA.map((p, i) => ({
          id: `mp_${matchId}_A_${i}`,
          match_id: matchId!,
          player_id: p.id,
          team: 'A',
          user_id: user.id,
          created_at: new Date().toISOString(),
        })),
        ...localTeamB.map((p, i) => ({
          id: `mp_${matchId}_B_${i}`,
          match_id: matchId!,
          player_id: p.id,
          team: 'B',
          user_id: user.id,
          created_at: new Date().toISOString(),
        })),
      ]
      const { error: insError } = await supabase.from('match_players').insert(rows)
      if (insError) throw insError

      queryClient.invalidateQueries({ queryKey: ['matchPlayers', matchId] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      Alert.alert('¡Guardado!', 'El partido ha sido actualizado.')
    } catch (err: any) {
      console.error('[match-detail] Error guardando cambios:', JSON.stringify(err, null, 2))
      Alert.alert('Error', err?.message || 'No se pudo guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  if (!match) {
    return (
      <ImageBackground
        source={require('@/assets/images/background-partidos.jpg')}
        style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        <Text style={{ color: '#D1D5DB' }}>Cargando...</Text>
      </ImageBackground>
    )
  }

  return (
    <ImageBackground
      source={require('@/assets/images/background-partidos.jpg')}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' }} />
                <Text style={styles.teamHeaderText}>EQUIPO A</Text>
              </View>
              <Text style={styles.teamAvg}>Media: {avgSkill(localTeamA)}</Text>
            </View>
            {localTeamA.map((p) => {
              const pos = p.position ? POSITIONS_INFO[p.position] : null
              return (
                <View key={p.id} style={styles.playerRow}>
                  <MaterialCommunityIcons
                    name={(pos ? pos.iconName : 'soccer') as any}
                    size={18}
                    color={pos ? pos.color : '#4ADE80'}
                    style={{ marginRight: 10 }}
                  />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' }} />
                <Text style={styles.teamHeaderText}>EQUIPO B</Text>
              </View>
              <Text style={styles.teamAvg}>Media: {avgSkill(localTeamB)}</Text>
            </View>
            {localTeamB.map((p) => {
              const pos = p.position ? POSITIONS_INFO[p.position] : null
              return (
                <View key={p.id} style={styles.playerRow}>
                  <MaterialCommunityIcons
                    name={(pos ? pos.iconName : 'soccer') as any}
                    size={18}
                    color={pos ? pos.color : '#4ADE80'}
                    style={{ marginRight: 10 }}
                  />
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

          {/* Actions — solo cuando no está finalizado */}
          {match.status !== 'finished' && (
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
          )}

          {match.status !== 'finished' && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveChanges}
              disabled={saving}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#0A3A17" />
              <Text style={styles.saveBtnText}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Resultado y MVP ── */}
          {match.status === 'finished' ? (
            <View style={styles.resultBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="trophy" size={15} color="#22C55E" />
                <Text style={[styles.resultTitle, { marginBottom: 0 }]}>Resultado final</Text>
              </View>

              {/* Marcador */}
              <View style={styles.resultScoreRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                  <Text style={styles.resultTeamLabel}>A</Text>
                </View>
                <Text style={styles.resultScoreNum}>{match.scoreA ?? '–'}</Text>
                <Text style={styles.resultColon}>:</Text>
                <Text style={styles.resultScoreNum}>{match.scoreB ?? '–'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                  <Text style={[styles.resultTeamLabel, { color: '#3B82F6' }]}>B</Text>
                </View>
              </View>

              {/* Equipos en dos columnas */}
              <View style={styles.resultTeamsRow}>
                <View style={styles.resultTeamCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                    <Text style={[styles.resultTeamColHeader, { marginBottom: 0 }]}>Equipo A</Text>
                  </View>
                  {localTeamA.map((p) => {
                    const isMvp = match.mvpPlayerId === p.id
                    const pos = p.position ? POSITIONS_INFO[p.position] : null
                    return (
                      <View key={p.id} style={styles.resultPlayerRow}>
                        <MaterialCommunityIcons
                          name={(pos?.iconName ?? 'soccer') as any}
                          size={14}
                          color={pos?.color ?? '#4ADE80'}
                          style={{ marginRight: 5 }}
                        />
                        <Text
                          style={[styles.resultPlayerName, isMvp && styles.resultPlayerMvp]}
                          numberOfLines={1}
                        >
                          {p.name}{isMvp ? ' ★' : ''}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              {/* MVP destacado */}
              {match.mvpPlayerId && (() => {
                const mvp = allPlayers.find(p => p.id === match.mvpPlayerId)
                const pos = mvp?.position ? POSITIONS_INFO[mvp.position] : null
                return (
                  <View style={styles.mvpResultBanner}>
                    <MaterialCommunityIcons name={(pos?.iconName ?? 'soccer') as any} size={30} color={pos?.color ?? '#4ADE80'} />
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text style={styles.mvpResultBannerLabel}>MVP del partido</Text>
                      </View>
                      <Text style={styles.mvpResultBannerName}>{mvp?.name ?? '–'}</Text>
                    </View>
                  </View>
                )
              })()}
              {/* Boton modificar resultado */}
              <TouchableOpacity
                style={styles.editResultBtn}
                onPress={() => {
                  // Sincronizar estado local con datos guardados antes de abrir
                  setScoreA(match.scoreA ?? 0)
                  setScoreB(match.scoreB ?? 0)
                  setMvpPlayerId(match.mvpPlayerId ?? null)
                  setShowEditResult(true)
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={16} color="#4ADE80" />
                <Text style={styles.editResultBtnText}>Modificar resultado</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.finishSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Ionicons name="flag-outline" size={16} color="#FFFFFF" />
                <Text style={[styles.finishSectionTitle, { marginBottom: 0 }]}>Finalizar partido</Text>
              </View>

              {/* Votar MVP */}
              <TouchableOpacity style={styles.voteBtn} onPress={handleShareVote} activeOpacity={0.85}>
                <Ionicons name="star-outline" size={18} color="#0A3A17" />
                <Text style={styles.voteBtnText}>Abrir votación MVP</Text>
              </TouchableOpacity>

              {/* Marcador */}
              <Text style={styles.finishLabel}>RESULTADO</Text>
              <View style={styles.scoreRow}>
                <View style={styles.scoreBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                    <Text style={[styles.scoreTeamLabel, { marginBottom: 0 }]}>Equipo A</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                    <Text style={[styles.scoreTeamLabel, { color: '#3B82F6', marginBottom: 0 }]}>Equipo B</Text>
                  </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={[styles.finishLabel, { marginBottom: 0 }]}>MVP DEL PARTIDO</Text>
              </View>
              {totalVotes > 0 && topVotedId && (
                <View style={styles.voteHint}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="bar-chart-outline" size={13} color="#D1D5DB" />
                    <Text style={styles.voteHintText}>
                      {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'} · lidera{' '}
                      <Text style={styles.voteHintName}>
                        {allPlayers.find(p => p.id === topVotedId)?.name ?? '...'}
                      </Text>
                      {' '}({voteCounts[topVotedId]})
                    </Text>
                  </View>
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mvpScroll} contentContainerStyle={{ paddingRight: 16 }}>
                {[...localTeamA, ...localTeamB].map((p) => {
                  const isSelected = mvpPlayerId === p.id
                  const pos = p.position ? POSITIONS_INFO[p.position] : null
                  const voteCount = voteCounts[p.id] ?? 0
                  const isTopVoted = p.id === topVotedId
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.mvpCard, isSelected && styles.mvpCardActive, isTopVoted && !isSelected && styles.mvpCardTopVoted]}
                      onPress={() => setMvpPlayerId(isSelected ? null : p.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name={(pos ? pos.iconName : 'soccer') as any}
                        size={22}
                        color={pos ? pos.color : '#4ADE80'}
                        style={{ marginBottom: 4 }}
                      />
                      <Text style={[styles.mvpName, isSelected && styles.mvpNameActive, isTopVoted && !isSelected && { color: '#A78BFA' }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {voteCount > 0 && (
                        <View style={[styles.mvpVoteBadge, isTopVoted && styles.mvpVoteBadgeTop]}>
                          <Text style={styles.mvpVoteBadgeText}>{voteCount}★</Text>
                        </View>
                      )}
                      {isSelected && !voteCount && <MaterialCommunityIcons name="star" size={14} color="#F59E0B" style={{ marginTop: 2 }} />}
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
                <Text style={styles.finishBtnText}>{saving ? 'Guardando...' : 'Finalizar partido'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Modal Modificar Resultado */}
        <Modal visible={showEditResult} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="create-outline" size={18} color="#4ADE80" />
                  <Text style={styles.modalTitle}>Modificar resultado</Text>
                </View>
                <TouchableOpacity onPress={() => setShowEditResult(false)}>
                  <Ionicons name="close" size={24} color="#C4C4C4" />
                </TouchableOpacity>
              </View>

              {/* Marcador */}
              <Text style={styles.finishLabel}>RESULTADO</Text>
              <View style={styles.scoreRow}>
                <View style={styles.scoreBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                    <Text style={[styles.scoreTeamLabel, { marginBottom: 0 }]}>Equipo A</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                    <Text style={[styles.scoreTeamLabel, { color: '#3B82F6', marginBottom: 0 }]}>Equipo B</Text>
                  </View>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 10 }}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={[styles.finishLabel, { marginBottom: 0 }]}>MVP DEL PARTIDO</Text>
              </View>
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
                      <MaterialCommunityIcons
                        name={(pos ? pos.iconName : 'soccer') as any}
                        size={22}
                        color={pos ? pos.color : '#4ADE80'}
                        style={{ marginBottom: 4 }}
                      />
                      <Text style={[styles.mvpName, isSelected && styles.mvpNameActive]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {isSelected && <MaterialCommunityIcons name="star" size={14} color="#F59E0B" style={{ marginTop: 2 }} />}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.applyBtn, saving && styles.applyBtnDisabled]}
                onPress={async () => {
                  if (!matchId) return
                  setSaving(true)
                  try {
                    const { error } = await supabase.from('matches').update({
                      score_a: scoreA, score_b: scoreB,
                      mvp_player_id: mvpPlayerId || null,
                    }).eq('id', matchId)
                    if (error) throw error
                    queryClient.invalidateQueries({ queryKey: ['match', matchId] })
                    queryClient.invalidateQueries({ queryKey: ['matches'] })
                    setShowEditResult(false)
                  } catch (err: any) {
                    Alert.alert('Error', err?.message || 'No se pudo guardar')
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
              >
                <Text style={styles.applyBtnText}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Player Picker Modal */}
        <Modal visible={showPlayerPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="people-outline" size={18} color="#4ADE80" />
                  <Text style={styles.modalTitle}>Cambiar jugadores</Text>
                </View>
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
                      <MaterialCommunityIcons
                        name={(pos ? pos.iconName : 'soccer') as any}
                        size={18}
                        color={pos ? pos.color : '#4ADE80'}
                        style={{ marginRight: 8 }}
                      />
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
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A3A17' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,58,23,0.82)',
  },
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
    marginTop: 16, backgroundColor: '#0D2818',
    borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: '#22C55E',
  },
  resultTitle: { fontSize: 15, fontWeight: '800', color: '#22C55E', marginBottom: 12, textAlign: 'center' },
  resultScoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  resultTeamLabel: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  resultScoreNum: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', minWidth: 44, textAlign: 'center' },
  resultColon: { fontSize: 36, fontWeight: '900', color: '#4ADE80' },
  resultTeamsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  resultTeamCol: { flex: 1 },
  resultTeamColHeader: {
    fontSize: 11, fontWeight: '800', color: '#EF4444',
    letterSpacing: 0.5, marginBottom: 8, textAlign: 'center',
  },
  resultDividerV: {
    width: 1, backgroundColor: 'rgba(74,222,128,0.15)', marginHorizontal: 4,
  },
  resultPlayerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  resultPlayerEmoji: { fontSize: 14, marginRight: 5 },
  resultPlayerName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#D1D5DB' },
  resultPlayerMvp: { color: '#F59E0B', fontWeight: '800' },
  mvpResultBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)',
  },
  mvpResultBannerEmoji: { fontSize: 30 },
  mvpResultBannerLabel: { fontSize: 11, color: '#F59E0B', fontWeight: '700', letterSpacing: 0.5 },
  mvpResultBannerName: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 1 },
  // Legacy (kept for safety)
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
  mvpCardTopVoted: { borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.1)' },
  mvpVoteBadge: {
    marginTop: 4, backgroundColor: 'rgba(167,139,250,0.2)',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1,
  },
  mvpVoteBadgeTop: { backgroundColor: 'rgba(167,139,250,0.5)' },
  mvpVoteBadgeText: { fontSize: 10, color: '#A78BFA', fontWeight: '800' },
  voteHint: {
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderRadius: 10, padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
  },
  voteHintText: { fontSize: 13, color: '#D1D5DB' },
  voteHintName: { color: '#A78BFA', fontWeight: '800' },
  editResultBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 12, height: 44,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
  },
  editResultBtnText: { fontSize: 13, fontWeight: '700', color: '#4ADE80' },
  finishBtn: {
    backgroundColor: '#22C55E', borderRadius: 14, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  finishBtnText: { fontSize: 15, fontWeight: '800', color: '#0A3A17' },
  voteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F59E0B', borderRadius: 14, height: 48, marginBottom: 20,
  },
  voteBtnText: { fontSize: 14, fontWeight: '800', color: '#0A3A17' },
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
