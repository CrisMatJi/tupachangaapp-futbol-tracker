import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ImageBackground,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Match } from '@/types'
import { formatDate } from '@/utils/date'
import { colors, spacing, radius, fontSize, layout } from '@/constants/theme'
import { useResponsive } from '@/hooks/useResponsive'

const MATCH_ICONS: Record<string, string> = {
  '5v5':   'soccer',
  '6v6':   'whistle-outline',
  '7v7':   'trophy-outline',
  '11v11': 'soccer-field',
}

export default function MatchesListScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { isDesktop } = useResponsive()

  const { data: matches = [], isLoading, isError, error } = useQuery({
    queryKey: ['matches', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id, userId: r.user_id, date: r.date,
        matchType: r.match_type, status: r.status,
        scoreA: r.score_a, scoreB: r.score_b,
        mvpPlayerId: r.mvp_player_id, createdAt: r.created_at,
      })) as Match[]
    },
    enabled: !!user,
  })

  const deleteMutation = useMutation({
    mutationFn: async (matchId: string) => {
      // Borrar match_players en bloque primero
      const { error: mpError } = await supabase.from('match_players').delete().eq('match_id', matchId)
      if (mpError) throw mpError
      const { error } = await supabase.from('matches').delete().eq('id', matchId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
    onError: (err: any) => Alert.alert('Error', err?.message),
  })

  const handleDelete = (match: Match) => {
    Alert.alert('Eliminar partido', `¿Eliminar el partido del ${formatDate(match.date)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(match.id),
      },
    ])
  }

  const renderItem = ({ item, index }: { item: Match; index: number }) => (
    <TouchableOpacity
      style={[styles.matchCard, isDesktop && styles.matchCardGrid]}
      onPress={() => router.push({ pathname: '/match-detail', params: { matchId: item.id } })}
      activeOpacity={0.82}
    >
      <View style={styles.matchLeft}>
        <View style={styles.matchEmoji}>
          <MaterialCommunityIcons name={(MATCH_ICONS[item.matchType] ?? 'soccer') as any} size={26} color={colors.accent.primary} />
        </View>
        <View>
          <Text style={styles.matchType}>{item.matchType.toUpperCase()} • {formatDate(item.date)}</Text>
          <Text style={styles.matchSub}>
            Partido #{matches.length - index}
          </Text>
          <View style={[styles.statusBadge, item.status === 'finished' && styles.statusBadgeFinished]}>
            <View style={[styles.statusDot, item.status === 'finished' && styles.statusDotFinished]} />
            <Text style={[styles.statusText, item.status === 'finished' && styles.statusTextFinished]}>
              {item.status === 'finished' ? 'Finalizado' : 'Creado'}
            </Text>
          </View>
          {item.status === 'finished' && item.scoreA !== undefined && item.scoreB !== undefined && (
            <Text style={styles.scoreText}>{item.scoreA} — {item.scoreB}</Text>
          )}
        </View>
      </View>
      <View style={styles.matchRight}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push({ pathname: '/match-detail', params: { matchId: item.id } })}
        >
          <Ionicons name="create-outline" size={18} color={colors.accent.light} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={18} color={colors.status.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )

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
            <Ionicons name="arrow-back" size={22} color={colors.accent.light} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="clipboard-outline" size={18} color={colors.text.primary} />
            <Text style={styles.headerTitle}>Mis Partidos</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/create-match')}
          >
            <Ionicons name="add" size={22} color={colors.text.inverse} />
          </TouchableOpacity>
        </View>

        {isError && (
          <View style={{ backgroundColor: '#7F1D1D', margin: 12, borderRadius: 10, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="warning-outline" size={16} color="#FCA5A5" />
              <Text style={{ color: '#FCA5A5', fontWeight: 'bold' }}>Error al cargar partidos</Text>
            </View>
            <Text style={{ color: '#FCA5A5', fontSize: 12 }}>{(error as any)?.message ?? String(error)}</Text>
          </View>
        )}

        <FlatList
          key={isDesktop ? 'grid' : 'list'}
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          numColumns={isDesktop ? 3 : 1}
          columnWrapperStyle={isDesktop ? styles.columnWrapper : undefined}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="soccer-field" size={64} color={colors.accent.light} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>
                {isLoading ? 'Cargando partidos...' : isError ? 'Error de conexión' : 'No hay partidos aún.\n¡Organiza uno!'}
              </Text>
              {!isLoading && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/create-match')}
                >
                  <Text style={styles.emptyBtnText}>Crear partido</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </SafeAreaView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.accent.muted,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent.muted,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text.primary },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 40,
    width: '100%',
    maxWidth: layout.maxWidthContent,
    alignSelf: 'center',
  },
  columnWrapper: { gap: spacing.md },
  matchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.deep, borderRadius: radius.lg,
    marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: colors.accent.muted,
  },
  matchCardGrid: { flex: 1, maxWidth: 340 },
  matchLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  matchEmoji: {
    width: 52, height: 52, borderRadius: radius.lg,
    backgroundColor: 'rgba(34,197,94,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md,
  },
  matchEmojiText: { fontSize: 26 },
  matchType: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text.primary, marginBottom: 2 },
  matchSub: { fontSize: fontSize.base, color: colors.text.secondary, marginBottom: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.primary },
  statusText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.accent.primary },
  statusBadgeFinished: { backgroundColor: 'rgba(59,130,246,0.12)' },
  statusDotFinished: { backgroundColor: '#60A5FA' },
  statusTextFinished: { color: '#93C5FD' },
  scoreText: { fontSize: fontSize.base, fontWeight: '800', color: colors.accent.light, marginTop: 3 },
  matchRight: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accent.muted,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { color: colors.text.secondary, fontSize: fontSize.lg, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: spacing.lg, backgroundColor: colors.accent.primary,
    borderRadius: radius.md, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md,
  },
  emptyBtnText: { color: colors.text.inverse, fontWeight: '700' },
})
