import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Player, Position } from '@/types'
import { POSITIONS } from '@/utils/positions'
import { colors, spacing, radius, fontSize, layout } from '@/constants/theme'

const posInfo = (pos?: string) => POSITIONS.find((p) => p.key === pos)

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ fontSize: size, color: i <= value ? colors.star.active : colors.star.inactive }}>
          ★
        </Text>
      ))}
    </View>
  )
}

export default function PlayersListScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
  const [editName, setEditName] = useState('')
  const [editSkill, setEditSkill] = useState(3)
  const [editPosition, setEditPosition] = useState<Position | null>(null)
  const [search, setSearch] = useState('')

  const { data: players = [], isLoading, isError, error } = useQuery({
    queryKey: ['players', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id, userId: r.user_id, name: r.name,
        skill: r.skill, position: r.position, createdAt: r.created_at,
      })) as Player[]
    },
    enabled: !!user,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Player> & { id: string }) => {
      const { error } = await supabase.from('players').update({
        name: data.name, skill: data.skill, position: data.position,
      }).eq('id', data.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setEditPlayer(null)
      Alert.alert('¡Actualizado!', 'El jugador ha sido modificado.')
    },
    onError: (err: any) => Alert.alert('Error', err?.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Comprobar si el jugador está vinculado a algún partido
      const { data: linked, error: checkError } = await supabase
        .from('match_players')
        .select('match_id, matches(date, match_type)')
        .eq('player_id', id)
        .limit(3)
      if (checkError) throw checkError

      if (linked && linked.length > 0) {
        const matchLines = linked
          .map((row: any) => {
            const m = row.matches
            if (!m) return '• Partido desconocido'
            const [y, mo, d] = (m.date as string).split('-')
            const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
            const fecha = `${d} ${MONTHS[parseInt(mo, 10) - 1]} ${y}`
            return `• ${m.match_type} — ${fecha}`
          })
          .join('\n')
        const extra = linked.length > 3 ? `\n…y ${linked.length - 3} más` : ''
        throw new Error(
          `Este jugador participa en ${linked.length} partido${linked.length > 1 ? 's' : ''}:\n\n${matchLines}${extra}\n\nElimina primero esos partidos y después podrás borrar al jugador.`
        )
      }

      const { error } = await supabase.from('players').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['players'] }),
    onError: (err: any) =>
      Alert.alert('No se puede eliminar', err?.message ?? 'Error desconocido.'),
  })

  const openEdit = (player: Player) => {
    setEditPlayer(player)
    setEditName(player.name)
    setEditSkill(player.skill)
    setEditPosition((player.position as Position) || null)
  }

  const handleUpdate = () => {
    if (!editName.trim() || !editPlayer) return
    if (!editPosition) {
      Alert.alert('Error', 'Debes seleccionar una posición.')
      return
    }
    updateMutation.mutate({
      id: editPlayer.id,
      name: editName.trim(),
      skill: editSkill,
      position: editPosition || undefined,
    })
  }

  const handleDelete = (player: Player) => {
    Alert.alert('Eliminar jugador', `¿Eliminar a ${player.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(player.id),
      },
    ])
  }

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const renderItem = ({ item }: { item: Player }) => {
    const pos = posInfo(item.position)
    return (
      <View style={styles.playerCard}>
        <View style={[styles.playerAvatar, pos && { borderColor: pos.color }]}>
          <MaterialCommunityIcons
            name={(pos ? pos.iconName : 'soccer') as any}
            size={22}
            color={pos ? pos.color : colors.accent.light}
          />
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>{item.name}</Text>
          <View style={styles.playerMeta}>
            <StarRating value={item.skill} />
            {pos && (
              <View style={[styles.posBadge, { backgroundColor: `${pos.color}22` }]}>
                <Text style={[styles.posBadgeText, { color: pos.color }]}>{item.position}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.playerActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
            <Ionicons name="create-outline" size={18} color={colors.accent.light} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={18} color={colors.status.danger} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ImageBackground
      source={require('@/assets/images/background-jugadores.jpeg')}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.accent.light} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="people-outline" size={18} color={colors.text.primary} />
            <Text style={styles.headerTitle}>Mis Jugadores</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/create-player')}
          >
            <Ionicons name="add" size={22} color={colors.text.inverse} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.text.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar jugador..."
            placeholderTextColor={colors.text.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* List */}
        {isError && (
          <View style={{ backgroundColor: '#7F1D1D', margin: 12, borderRadius: 10, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="warning-outline" size={16} color="#FCA5A5" />
              <Text style={{ color: '#FCA5A5', fontWeight: 'bold' }}>Error al cargar jugadores</Text>
            </View>
            <Text style={{ color: '#FCA5A5', fontSize: 12 }}>{(error as any)?.message ?? String(error)}</Text>
          </View>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="soccer-field" size={56} color={colors.accent.light} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>
                {isLoading ? 'Cargando jugadores...' : isError ? 'Error de conexión' : 'No hay jugadores aún.\n¡Crea el primero!'}
              </Text>
              {!isLoading && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/create-player')}
                >
                  <Text style={styles.emptyBtnText}>Crear jugador</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        {/* Edit Modal */}
        <Modal visible={!!editPlayer} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalWrap}
            >
              <View style={styles.modal}>
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="create-outline" size={18} color={colors.accent.light} />
                    <Text style={styles.modalTitle}>Editar Jugador</Text>
                  </View>
                  <TouchableOpacity onPress={() => setEditPlayer(null)}>
                    <Ionicons name="close" size={24} color="#C4C4C4" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Nombre</Text>
                <View style={styles.field}>
                  <TextInput
                    style={styles.fieldInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Nombre"
                    placeholderTextColor={colors.text.muted}
                  />
                </View>

                <Text style={styles.label}>Potencial</Text>
                <View style={styles.skillRow}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.skillBtn, editSkill === v && styles.skillBtnActive]}
                      onPress={() => setEditSkill(v)}
                    >
                      <Text style={[styles.skillStar, editSkill >= v && styles.skillStarActive]}>★</Text>
                      <Text style={[styles.skillLabel2, editSkill === v && styles.skillLabelActive]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Posición</Text>
                <View style={styles.posRow}>
                  {POSITIONS.map((pos) => (
                    <TouchableOpacity
                      key={pos.key}
                      style={[styles.posChip, editPosition === pos.key && { borderColor: pos.color, backgroundColor: `${pos.color}22` }]}
                      onPress={() => setEditPosition(pos.key)}
                    >
                      <MaterialCommunityIcons
                        name={pos.iconName as any}
                        size={14}
                        color={editPosition === pos.key ? pos.color : colors.text.muted}
                      />
                      <Text style={[styles.posChipText, editPosition === pos.key && { color: pos.color }]}>{pos.key}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, updateMutation.isPending && styles.saveBtnDisabled]}
                  onPress={handleUpdate}
                  disabled={updateMutation.isPending}
                >
                  <Text style={styles.saveBtnText}>
                    {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent.muted,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    margin: spacing.lg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  searchInput: { flex: 1, height: 44, color: colors.text.primary, fontSize: fontSize.md },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: layout.maxWidthContent,
    alignSelf: 'center',
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    marginBottom: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  playerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.bg.deeper,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.accent.primary,
    marginRight: spacing.md,
  },
  playerAvatarText: { fontSize: 22 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  playerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  posBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  posBadgeText: { fontSize: fontSize.sm, fontWeight: '700' },
  playerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accent.muted,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: { backgroundColor: 'rgba(239,68,68,0.1)' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.text.secondary, fontSize: fontSize.lg, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: spacing.lg, backgroundColor: colors.accent.primary,
    borderRadius: radius.md, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md,
  },
  emptyBtnText: { color: colors.text.inverse, fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalWrap: { justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xxl, paddingBottom: 36,
    borderTopWidth: 1, borderColor: colors.accent.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl },
  modalTitle: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text.primary },
  label: { fontSize: fontSize.base, fontWeight: '700', color: 'rgba(255,255,255,0.75)', marginBottom: spacing.sm, textTransform: 'uppercase' },
  field: {
    backgroundColor: '#1A1A2E', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent.border,
    paddingHorizontal: 14, marginBottom: spacing.lg,
  },
  fieldInput: { height: 46, color: colors.text.primary, fontSize: fontSize.lg },
  skillRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  skillBtn: {
    flex: 1, backgroundColor: '#1A1A2E', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border.subtle,
  },
  skillBtnActive: { borderColor: colors.star.active, backgroundColor: 'rgba(245,158,11,0.12)' },
  skillStar: { fontSize: 20, color: colors.text.secondary },
  skillStarActive: { color: colors.star.active },
  skillLabel2: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text.secondary, marginTop: 2 },
  skillLabelActive: { color: colors.star.active },
  posRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.xxl },
  posChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#1A1A2E', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.border.subtle,
  },
  posChipText: { fontSize: fontSize.base, fontWeight: '700', color: colors.text.secondary },
  saveBtn: {
    backgroundColor: colors.accent.primary, borderRadius: radius.lg,
    height: 50, justifyContent: 'center', alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text.inverse },
})
