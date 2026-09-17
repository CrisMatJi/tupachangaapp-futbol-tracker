import { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ImageBackground,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { colors, spacing, radius, fontSize, layout } from '@/constants/theme'

interface MenuItemProps {
  icon: string
  title: string
  subtitle: string
  color: string
  bgColor: string
  onPress: () => void
}

function MenuItem({ icon, title, subtitle, color, bgColor, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress() }}
      activeOpacity={0.82}
    >
      <View style={[styles.menuIcon, { backgroundColor: bgColor }]}>
        <MaterialCommunityIcons name={icon as any} size={26} color={color} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.menuArrow, { backgroundColor: bgColor }]}>
        <Ionicons name="chevron-forward" size={18} color={color} />
      </View>
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const { user, loading } = useAuth()

  // Si el estado de auth cambia a null (signOut), redirigir automáticamente
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth')
    }
  }, [user, loading])

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut()
          } catch (_) {
            // ignorar error del SDK, navegar igualmente
          }
          router.replace('/auth')
        },
      },
    ])
  }

  return (
    <ImageBackground
      source={require('@/assets/images/background-partidos.jpg')}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>¡Bienvenido!</Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.accent.light} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="soccer" size={30} color={colors.text.primary} style={{ marginRight: 8 }} />
            <Text style={styles.appTitle}>tuPachanga</Text>
          </View>
          <Text style={styles.appSubtitle}>App</Text>
          <View style={styles.titleDecor} />
        </View>

        {/* Grass strip */}
        <View style={styles.grassStrip}>
          <View style={styles.grassInner}>
            <MaterialCommunityIcons name="soccer" size={13} color={colors.accent.light} />
            <Text style={styles.grassText}>  EL CAMPO TE ESPERA  </Text>
            <MaterialCommunityIcons name="soccer" size={13} color={colors.accent.light} />
          </View>
        </View>

        {/* Menu */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <MenuItem
            icon="account-plus-outline"
            title="Crear Jugador"
            subtitle="Añade un nuevo crack al equipo"
            color="#F59E0B"
            bgColor="rgba(245,158,11,0.15)"
            onPress={() => router.push('/create-player')}
          />
          <MenuItem
            icon="soccer"
            title="Crear Partido"
            subtitle="Organiza una nueva pachanga"
            color={colors.accent.primary}
            bgColor="rgba(34,197,94,0.15)"
            onPress={() => router.push('/create-match')}
          />
          <MenuItem
            icon="clipboard-list-outline"
            title="Partidos Existentes"
            subtitle="Ver y editar partidos anteriores"
            color="#3B82F6"
            bgColor="rgba(59,130,246,0.15)"
            onPress={() => router.push('/matches-list')}
          />
          <MenuItem
            icon="account-group-outline"
            title="Listado de Jugadores"
            subtitle="Gestiona tus jugadores disponibles"
            color="#A78BFA"
            bgColor="rgba(167,139,250,0.15)"
            onPress={() => router.push('/players-list')}
          />

          {/* Stats decoration */}
          <LinearGradient
            colors={['rgba(34,197,94,0.08)', 'rgba(34,197,94,0.03)']}
            style={styles.promoCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons name="trophy" size={32} color={colors.accent.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>Organiza partidos perfectos</Text>
              <Text style={styles.promoSub}>Equipos equilibrados automáticamente por posición y nivel</Text>
            </View>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlayMenu,
  },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: 8,
    paddingBottom: 4,
  },
  welcomeText: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  userEmail: { fontSize: fontSize.base, color: colors.accent.light, fontWeight: '600', maxWidth: 220 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlock: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  appTitle: { fontSize: 32, fontWeight: '900', color: colors.text.primary, letterSpacing: -0.5 },
  appSubtitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.accent.light,
    letterSpacing: -0.3,
    marginTop: -4,
  },
  titleDecor: {
    marginTop: spacing.sm,
    width: 60,
    height: 3,
    backgroundColor: colors.accent.primary,
    borderRadius: 2,
  },
  grassStrip: {
    backgroundColor: colors.bg.deeper,
    marginHorizontal: spacing.lg,
    marginVertical: 10,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  grassInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grassText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.accent.light,
    letterSpacing: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: layout.maxWidthContent,
    alignSelf: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.deep,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.12)',
  },
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuEmoji: { fontSize: 26 },
  menuText: { flex: 1 },
  menuTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary, marginBottom: 3 },
  menuSubtitle: { fontSize: fontSize.base, color: colors.text.secondary, fontWeight: '400', lineHeight: 18 },
  menuArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bg.section,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statLabel: { fontSize: fontSize.xs, color: colors.text.secondary, fontWeight: '500', textAlign: 'center' },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: 8,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  promoEmoji: { fontSize: 32 },
  promoTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  promoSub: { fontSize: fontSize.base, color: colors.text.secondary, lineHeight: 17 },
})
