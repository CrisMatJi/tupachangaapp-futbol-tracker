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
            <Ionicons name="arrow-back" size={22} color="#4ADE80" />
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
                <MaterialCommunityIcons name="soccer" size={36} color="#22C55E" />
              </View>
              <Text style={styles.avatarHint}>Nuevo jugador</Text>
            </View>

            {/* Name */}
            <Text style={styles.label}>Nombre del jugador *</Text>
            <View style={styles.field}>
              <Ionicons name="person-outline" size={18} color="#4ADE80" style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ej: Messi, Ronaldo..."
                placeholderTextColor="#9CA3AF"
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
                    color={position === pos.key ? pos.color : '#9CA3AF'}
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
              <Ionicons name="checkmark-circle-outline" size={22} color="#0A3A17" />
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
    backgroundColor: 'rgba(10,58,23,0.80)',
  },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(74,222,128,0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74,222,128,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  scroll: { padding: 20, paddingBottom: 40 },
  avatarBlock: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#166534',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#22C55E',
  },
  avatarEmoji: { fontSize: 36 },
  avatarHint: { fontSize: 13, color: '#D1D5DB', marginTop: 8 },
  label: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  required: { fontWeight: '700', color: '#EF4444' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.15)',
    paddingHorizontal: 12,
  },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: '#FFFFFF', fontSize: 15 },
  skillRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  skillBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  skillBtnActive: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)' },
  skillStar: { fontSize: 22, color: '#D1D5DB' },
  skillStarActive: { color: '#F59E0B' },
  skillLabel: { fontSize: 11, fontWeight: '700', color: '#D1D5DB', marginTop: 2 },
  skillLabelActive: { color: '#F59E0B' },
  skillDesc: { fontSize: 13, color: '#D1D5DB', marginBottom: 20, textAlign: 'center' },
  posGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  posBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  posBtnActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.12)' },
  posEmoji: { fontSize: 24, marginBottom: 4 },
  posKey: { fontSize: 16, fontWeight: '900', color: '#D1D5DB' },
  posKeyActive: { color: '#22C55E' },
  posLabel: { fontSize: 11, color: '#D1D5DB', marginTop: 2 },
  saveBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#0A3A17' },
})
