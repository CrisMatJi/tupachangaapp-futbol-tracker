import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { blink } from '@/lib/blink'
import { useAuth } from '@/hooks/useAuth'
import { FieldLines } from '@/components/FootballBackground'

interface MenuItemProps {
  icon: any
  emoji: string
  title: string
  subtitle: string
  color: string
  bgColor: string
  onPress: () => void
}

function MenuItem({ icon, emoji, title, subtitle, color, bgColor, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.menuIcon, { backgroundColor: bgColor }]}>
        <Text style={styles.menuEmoji}>{emoji}</Text>
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
  const { user } = useAuth()

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await blink.auth.signOut()
          router.replace('/auth')
        },
      },
    ])
  }

  return (
    <View style={styles.root}>
      <FieldLines />
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
            <Ionicons name="log-out-outline" size={22} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.appTitle}>⚽ tuPachanga</Text>
          <Text style={styles.appSubtitle}>App</Text>
          <View style={styles.titleDecor} />
        </View>

        {/* Grass strip */}
        <View style={styles.grassStrip}>
          <Text style={styles.grassText}>🏟️  EL CAMPO TE ESPERA  🏟️</Text>
        </View>

        {/* Menu */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <MenuItem
            emoji="⭐"
            icon="person-add-outline"
            title="Crear Jugador"
            subtitle="Añade un nuevo crack al equipo"
            color="#F59E0B"
            bgColor="rgba(245,158,11,0.15)"
            onPress={() => router.push('/create-player')}
          />
          <MenuItem
            emoji="🏆"
            icon="football-outline"
            title="Crear Partido"
            subtitle="Organiza una nueva pachanga"
            color="#22C55E"
            bgColor="rgba(34,197,94,0.15)"
            onPress={() => router.push('/create-match')}
          />
          <MenuItem
            emoji="📋"
            icon="list-outline"
            title="Partidos Existentes"
            subtitle="Ver y editar partidos anteriores"
            color="#3B82F6"
            bgColor="rgba(59,130,246,0.15)"
            onPress={() => router.push('/matches-list')}
          />
          <MenuItem
            emoji="👥"
            icon="people-outline"
            title="Listado de Jugadores"
            subtitle="Gestiona tus jugadores disponibles"
            color="#A78BFA"
            bgColor="rgba(167,139,250,0.15)"
            onPress={() => router.push('/players-list')}
          />

          {/* Stats decoration */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🥅</Text>
              <Text style={styles.statLabel}>Portería lista</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🟠</Text>
              <Text style={styles.statLabel}>Conos puestos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🦺</Text>
              <Text style={styles.statLabel}>Petos listos</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A3A17' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  welcomeText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  userEmail: { fontSize: 13, color: '#4ADE80', fontWeight: '600', maxWidth: 220 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74,222,128,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlock: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  appTitle: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  appSubtitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#4ADE80',
    letterSpacing: -0.3,
    marginTop: -4,
  },
  titleDecor: {
    marginTop: 8,
    width: 60,
    height: 3,
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
  grassStrip: {
    backgroundColor: '#166534',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  grassText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4ADE80',
    letterSpacing: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuEmoji: { fontSize: 26 },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  menuSubtitle: { fontSize: 12, color: '#6B7280', fontWeight: '400' },
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statLabel: { fontSize: 10, color: '#6B7280', fontWeight: '500', textAlign: 'center' },
})
