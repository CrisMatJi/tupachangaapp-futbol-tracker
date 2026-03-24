import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Share,
  Linking,
  ImageBackground,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Player, MatchType, Position } from '@/types'
import { MATCH_TYPE_LIMITS } from '@/types'
import { balanceTeams, avgSkill } from '@/utils/teamBalance'
import { POSITIONS_INFO, getPositionInfo } from '@/utils/positions'

const MATCH_TYPES: { key: MatchType; label: string; iconName: string; total: number }[] = [
  { key: '5v5',   label: '5 contra 5',   iconName: 'soccer',         total: 10 },
  { key: '6v6',   label: '6 contra 6',   iconName: 'whistle-outline', total: 12 },
  { key: '7v7',   label: '7 contra 7',   iconName: 'trophy-outline',  total: 14 },
  { key: '11v11', label: '11 contra 11', iconName: 'soccer-field',    total: 22 },
]



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
  const [showDatePicker, setShowDatePicker] = useState(false)

  const limit = MATCH_TYPE_LIMITS[matchType]

  const { data: players = [] } = useQuery({
    queryKey: ['players', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id, userId: r.user_id, name: r.name,
        skill: r.skill, position: r.position, createdAt: r.created_at,
      })) as Player[]
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
      // Comprobar si ya existe un partido en esa fecha
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .limit(1)
      if (existing && existing.length > 0) {
        Alert.alert('Fecha duplicada', `Ya tienes un partido el ${date}. Solo se permite un partido por día.`)
        setSaving(false)
        return
      }

      const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const { error: matchError } = await supabase.from('matches').insert({
        id: matchId,
        user_id: user.id,
        date,
        match_type: matchType,
        status: 'created',
        created_at: new Date().toISOString(),
      })
      if (matchError) throw matchError

      const rows = [
        ...teams.teamA.map((p, i) => ({
          id: `mp_${matchId}_A_${i}`,
          match_id: matchId,
          player_id: p.id,
          team: 'A',
          user_id: user.id,
          created_at: new Date().toISOString(),
        })),
        ...teams.teamB.map((p, i) => ({
          id: `mp_${matchId}_B_${i}`,
          match_id: matchId,
          player_id: p.id,
          team: 'B',
          user_id: user.id,
          created_at: new Date().toISOString(),
        })),
      ]
      const { error: mpError } = await supabase.from('match_players').insert(rows)
      if (mpError) throw mpError

      queryClient.invalidateQueries({ queryKey: ['matches'] })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('¡Partido creado!', '¡El partido ha sido guardado!', [
        { text: 'Ver partidos', onPress: () => router.replace('/matches-list') },
        { text: 'Nuevo partido', onPress: () => router.replace('/create-match') },
      ])
    } catch (err: any) {
      console.error('[create-match] Error guardando partido:', JSON.stringify(err, null, 2))
      Alert.alert('Error al guardar', err?.message || 'No se pudo guardar el partido.')
    } finally {
      setSaving(false)
    }
  }

  const handleRedoTeams = () => {
    const result = balanceTeams(selectedPlayers)
    setTeams(result)
  }

  const formatLineup = (): string => {
    if (!teams) return ''
    const teamAText = teams.teamA
      .map(p => `  [${p.position ?? '?'}] ${p.name}`)
      .join('\n')
    const teamBText = teams.teamB
      .map(p => `  [${p.position ?? '?'}] ${p.name}`)
      .join('\n')
    return `⚽ *tuPachanga — Alineación*\n📅 ${date}  ·  ${matchType.toUpperCase()}\n\n🔴 *EQUIPO A*\n${teamAText}\n\n🔵 *EQUIPO B*\n${teamBText}\n\n🏆 Organizado con tuPachanga`
  }

  const handleShareLineup = async () => {
    try {
      await Share.share({ message: formatLineup() })
    } catch {}
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

  // STEP: SETUP
  if (step === 'setup') {
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="trophy-outline" size={18} color="#FFFFFF" />
              <Text style={styles.headerTitle}>Nuevo Partido</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Date */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.sectionLabel}>Fecha del partido</Text>
            </View>
            <TouchableOpacity style={styles.dateCard} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={20} color="#4ADE80" />
              <Text style={styles.dateText}>{date}</Text>
              <View style={styles.calendarBtn}>
                <Ionicons name="pencil-outline" size={16} color="#4ADE80" />
              </View>
            </TouchableOpacity>

            {/* DatePicker (Android: modal nativo automático) */}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={new Date(date + 'T12:00:00')}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false)
                  if (event.type !== 'dismissed' && selectedDate) {
                    setDate(selectedDate.toISOString().split('T')[0])
                  }
                }}
              />
            )}
            {/* DatePicker (iOS: modal con scroll) */}
            <Modal
              visible={showDatePicker && Platform.OS === 'ios'}
              transparent
              animationType="slide"
            >
              <View style={styles.datePickerOverlay}>
                <View style={styles.datePickerContainer}>
                  <View style={styles.datePickerHeader}>
                    <Text style={styles.datePickerTitle}>Seleccionar fecha</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.datePickerDone}>Listo ✓</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={new Date(date + 'T12:00:00')}
                    mode="date"
                    display="spinner"
                    textColor="#FFFFFF"
                    onChange={(_, selectedDate) => {
                      if (selectedDate) setDate(selectedDate.toISOString().split('T')[0])
                    }}
                  />
                </View>
              </View>
            </Modal>

            {/* Match Type */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <MaterialCommunityIcons name="soccer" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.sectionLabel}>Tipo de partido</Text>
            </View>
            <View style={styles.typeGrid}>
              {MATCH_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt.key}
                  style={[styles.typeCard, matchType === mt.key && styles.typeCardActive]}
                  onPress={() => { setMatchType(mt.key); setSelectedPlayers([]) }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={mt.iconName as any}
                    size={28}
                    color={matchType === mt.key ? '#22C55E' : '#9CA3AF'}
                    style={{ marginBottom: 6 }}
                  />
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
              onPress={() => {
                if (players.length === 0) {
                  Alert.alert(
                    'Sin jugadores',
                    'Debes crear jugadores antes de organizar un partido.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Crear jugador', onPress: () => router.push('/create-player') },
                    ]
                  )
                  return
                }
                setStep('players')
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Seleccionar jugadores →</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    )
  }

  // STEP: PLAYERS
  if (step === 'players') {
    return (
      <ImageBackground
        source={require('@/assets/images/background-partidos.jpg')}
        style={styles.root}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('setup')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#4ADE80" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="people-outline" size={18} color="#FFFFFF" />
              <Text style={styles.headerTitle}>Elegir Jugadores</Text>
            </View>
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
                <MaterialCommunityIcons name="account-group-outline" size={56} color="#4ADE80" style={{ marginBottom: 12 }} />
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
                      <MaterialCommunityIcons
                        name={(pos ? pos.iconName : 'soccer') as any}
                        size={18}
                        color={pos ? pos.color : '#4ADE80'}
                      />
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
                          <Text style={{ fontSize: 11, color: '#D1D5DB', marginLeft: 4 }}>{player.position}</Text>
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
      </ImageBackground>
    )
  }

  // STEP: TEAMS
  return (
    <ImageBackground
      source={require('@/assets/images/background-partidos.jpg')}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('players')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#4ADE80" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="trophy-outline" size={18} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Equipos</Text>
          </View>
          <TouchableOpacity style={styles.redoBtn} onPress={handleShareLineup} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={22} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.teamsContainer}>
            {/* Team A */}
            <View style={[styles.teamCard, styles.teamCardA]}>
              <View style={styles.teamHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' }} />
                  <Text style={styles.teamHeaderText}>EQUIPO A</Text>
                </View>
                <Text style={styles.teamAvg}>Media: {avgSkill(teams?.teamA || [])}</Text>
              </View>
              {teams?.teamA.map((p) => {
                const pos = p.position ? POSITIONS_INFO[p.position] : null
                return (
                  <View key={p.id} style={styles.teamPlayerRow}>
                    <MaterialCommunityIcons
                      name={(pos ? pos.iconName : 'soccer') as any}
                      size={16}
                      color={pos ? pos.color : '#4ADE80'}
                      style={{ marginRight: 8 }}
                    />
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' }} />
                  <Text style={styles.teamHeaderText}>EQUIPO B</Text>
                </View>
                <Text style={styles.teamAvg}>Media: {avgSkill(teams?.teamB || [])}</Text>
              </View>
              {teams?.teamB.map((p) => {
                const pos = p.position ? POSITIONS_INFO[p.position] : null
                return (
                  <View key={p.id} style={styles.teamPlayerRow}>
                    <MaterialCommunityIcons
                      name={(pos ? pos.iconName : 'soccer') as any}
                      size={16}
                      color={pos ? pos.color : '#4ADE80'}
                      style={{ marginRight: 8 }}
                    />
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
            onPress={handleSaveMatch}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={saving ? ['#374151', '#374151'] : ['#22C55E', '#16A34A']}
              style={styles.saveMatchBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={styles.saveMatchBtnText}>
                {saving ? 'Guardando...' : 'Guardar partido'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,58,23,0.80)',
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  // Date
  dateCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 14, padding: 14,
    marginBottom: 20, gap: 10,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.15)',
  },
  dateText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  calendarBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  // DatePicker modal (iOS)
  datePickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 34, borderTopWidth: 1,
    borderColor: 'rgba(74,222,128,0.15)',
  },
  datePickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10,
  },
  datePickerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  datePickerDone: { fontSize: 15, fontWeight: '800', color: '#22C55E' },
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
  typeKey: { fontSize: 18, fontWeight: '900', color: '#D1D5DB', marginBottom: 2 },
  typeKeyActive: { color: '#22C55E' },
  typeLabel: { fontSize: 11, color: '#D1D5DB', marginBottom: 2 },
  typeTotal: { fontSize: 10, color: '#D1D5DB' },
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
  infoBadgeLabel: { fontSize: 10, color: '#D1D5DB', marginBottom: 2 },
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
  emptyText: { color: '#D1D5DB', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: 16, backgroundColor: '#22C55E',
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: '#0A3A17', fontWeight: '700' },
  // Compartir
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
