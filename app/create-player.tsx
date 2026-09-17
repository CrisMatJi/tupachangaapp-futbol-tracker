import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import type { Position } from '@/types'
import { POSITIONS } from '@/utils/positions'
import { colors, spacing, radius, fontSize, layout } from '@/constants/theme'

export default function CreatePlayerScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [skill, setSkill] = useState(3)
  const [position, setPosition] = useState<Position | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre del jugador es obligatorio.')
      return
    }
    if (!position) {
      Alert.alert('Error', 'Debes seleccionar una posición para el jugador.')
      return
    }
    if (!user) return

    setLoading(true)
    try {
      // Comprobar si ya existe un jugador con ese nombre
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', name.trim())
        .limit(1)
      if (existing && existing.length > 0) {
        Alert.alert('Nombre duplicado', `Ya tienes un jugador llamado "${name.trim()}". Elige otro nombre.`)
        setLoading(false)
        return
      }

      const { error } = await supabase.from('players').insert({
        id: `player_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: user.id,
        name: name.trim(),
        skill,
        position: position || undefined,
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['players'] })
      Alert.alert('¡Listo!', `${name.trim()} ha sido añadido al equipo.`, [
        { text: 'Crear otro', onPress: () => { setName(''); setSkill(3); setPosition(null) } },
        { text: 'Ir al menú', onPress: () => router.replace('/home') },
      ])
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo crear el jugador.')
    } finally {
      setLoading(false)
    }
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
          <Text style={styles.headerTitle}>Crear Jugador</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar placeholder */}
            <View style={styles.avatarBlock}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="soccer" size={36} color={colors.accent.primary} />
              </View>
              <Text style={styles.avatarHint}>Nuevo jugador</Text>
            </View>

            {/* Name */}
            <Text style={styles.label}>Nombre del jugador *</Text>
            <View style={styles.field}>
              <Ionicons name="person-outline" size={18} color={colors.accent.light} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ej: Messi, Ronaldo..."
                placeholderTextColor={colors.text.muted}
                value={name}
                onChangeText={setName}
                maxLength={40}
              />
            </View>

            {/* Skill */}
            <Text style={styles.label}>Potencial futbolístico</Text>
            <View style={styles.skillRow}>
              {[1, 2, 3, 4, 5].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.skillBtn, skill === val && styles.skillBtnActive]}
                  onPress={() => setSkill(val)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.skillStar, skill >= val && styles.skillStarActive]}>
                    ★
                  </Text>
                  <Text style={[styles.skillLabel, skill === val && styles.skillLabelActive]}>
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.skillDesc}>
              {skill === 1 && 'Principiante · Apenas está aprendiendo'}
              {skill === 2 && 'Amateur · Juega con ganas'}
              {skill === 3 && 'Regular · Buen nivel promedio'}
              {skill === 4 && 'Bueno · Se le ve calidad'}
              {skill === 5 && 'Crack · ¡Nivel profesional!'}
            </Text>

            {/* Position */}
            <Text style={styles.label}>Posición <Text style={styles.required}>*</Text></Text>
            <View style={styles.posGrid}>
              {POSITIONS.map((pos) => (
                <TouchableOpacity
                  key={pos.key}
                  style={[styles.posBtn, position === pos.key && styles.posBtnActive]}
                  onPress={() => setPosition(pos.key)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={pos.iconName as any}
                    size={24}
                    color={position === pos.key ? pos.color : colors.text.muted}
                    style={{ marginBottom: 4 }}
                  />
                  <Text style={[styles.posKey, position === pos.key && styles.posKeyActive]}>
                    {pos.key}
                  </Text>
                  <Text style={styles.posLabel}>{pos.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color={colors.text.inverse} />
              <Text style={styles.saveBtnText}>
                {loading ? 'Guardando...' : '¡Añadir al equipo!'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
  flex: { flex: 1 },
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text.primary },
  scroll: {
    padding: spacing.xxl,
    paddingBottom: 40,
    width: '100%',
    maxWidth: layout.maxWidthForm,
    alignSelf: 'center',
  },
  avatarBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg.deeper,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.accent.primary,
  },
  avatarEmoji: { fontSize: 36 },
  avatarHint: { fontSize: fontSize.base, color: colors.text.secondary, marginTop: spacing.sm },
  label: { fontSize: fontSize.base, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginBottom: spacing.sm, letterSpacing: 0.5, textTransform: 'uppercase' },
  required: { fontWeight: '700', color: colors.status.danger },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.accent.border,
    paddingHorizontal: spacing.md,
  },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: colors.text.primary, fontSize: fontSize.lg },
  skillRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.sm },
  skillBtn: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  skillBtnActive: { borderColor: colors.star.active, backgroundColor: 'rgba(245,158,11,0.12)' },
  skillStar: { fontSize: 22, color: colors.text.secondary },
  skillStarActive: { color: colors.star.active },
  skillLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text.secondary, marginTop: 2 },
  skillLabelActive: { color: colors.star.active },
  skillDesc: { fontSize: fontSize.base, color: colors.text.secondary, marginBottom: spacing.xxl, textAlign: 'center' },
  posGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  posBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  posBtnActive: { borderColor: colors.accent.primary, backgroundColor: 'rgba(34,197,94,0.12)' },
  posEmoji: { fontSize: 24, marginBottom: 4 },
  posKey: { fontSize: fontSize.xl, fontWeight: '900', color: colors.text.secondary },
  posKeyActive: { color: colors.accent.primary },
  posLabel: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 },
  saveBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.lg,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text.inverse },
})
