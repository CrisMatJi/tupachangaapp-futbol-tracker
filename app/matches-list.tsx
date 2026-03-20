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
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Match } from '@/types'
import { formatDate } from '@/utils/date'

const MATCH_EMOJIS: Record<string, string> = {
  '5v5': '⚡',
  '6v6': '🥅',
  '7v7': '🏆',
  '11v11': '🌟',
}

export default function MatchesListScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

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
      style={styles.matchCard}
      onPress={() => router.push({ pathname: '/match-detail', params: { matchId: item.id } })}
      activeOpacity={0.82}
    >
      <View style={styles.matchLeft}>
        <View style={styles.matchEmoji}>
          <Text style={styles.matchEmojiText}>{MATCH_EMOJIS[item.matchType] || '⚽'}</Text>
        </View>
        <View>
          <Text style={styles.matchType}>{item.matchType.toUpperCase()} • {formatDate(item.date)}</Text>
          <Text style={styles.matchSub}>
            Partido #{matches.length - index}
          </Text>
          <View style={[styles.statusBadge, item.status === 'finished' && styles.statusBadgeFinished]}>
            <View style={[styles.statusDot, item.status === 'finished' && styles.statusDotFinished]} />
            <Text style={[styles.statusText, item.status === 'finished' && styles.statusTextFinished]}>
              {item.status === 'finished' ? '✅ Finalizado' : 'Creado'}
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
          <Ionicons name="create-outline" size={18} color="#4ADE80" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
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
            <Ionicons name="arrow-back" size={22} color="#4ADE80" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📋 Mis Partidos</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/create-match')}
          >
            <Ionicons name="add" size={22} color="#0A3A17" />
          </TouchableOpacity>
        </View>

        {isError && (
          <View style={{ backgroundColor: '#7F1D1D', margin: 12, borderRadius: 10, padding: 12 }}>
            <Text style={{ color: '#FCA5A5', fontWeight: 'bold', marginBottom: 4 }}>⚠️ Error al cargar partidos</Text>
            <Text style={{ color: '#FCA5A5', fontSize: 12 }}>{(error as any)?.message ?? String(error)}</Text>
          </View>
        )}

        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏟️</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#22C55E',
    justifyContent: 'center', alignItems: 'center',
  },
  list: { padding: 16, paddingBottom: 40 },
  matchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0D1F0D', borderRadius: 14,
    marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.1)',
  },
  matchLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  matchEmoji: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  matchEmojiText: { fontSize: 26 },
  matchType: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  matchSub: { fontSize: 12, color: '#D1D5DB', marginBottom: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#22C55E' },
  statusBadgeFinished: { backgroundColor: 'rgba(59,130,246,0.12)' },
  statusDotFinished: { backgroundColor: '#60A5FA' },
  statusTextFinished: { color: '#93C5FD' },
  scoreText: { fontSize: 13, fontWeight: '800', color: '#4ADE80', marginTop: 3 },
  matchRight: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { color: '#D1D5DB', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: 16, backgroundColor: '#22C55E',
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: '#0A3A17', fontWeight: '700' },
})
