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
import { blink } from '@/lib/blink'
import { FieldLines } from '@/components/FootballBackground'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos.')
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await blink.auth.signInWithEmail(email.trim(), password)
      } else {
        await blink.auth.signUp({ email: email.trim(), password })
      }
      router.replace('/home')
    } catch (err: any) {
      const msg = err?.message || 'Ocurrió un error. Inténtalo de nuevo.'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ImageBackground
      source={require('@/assets/images/background-login.jpeg')}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <FieldLines />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Header */}
          <View style={styles.header}>
            <View style={styles.ballContainer}>
              <Text style={styles.ballEmoji}>⚽</Text>
            </View>
            <Text style={styles.appTitle}>tuPachanga</Text>
            <Text style={styles.appSubtitle}>App</Text>
            <Text style={styles.tagline}>Organiza tu partido perfecto</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Toggle */}
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === 'login' && styles.toggleActive]}
                onPress={() => setMode('login')}
              >
                <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>
                  Iniciar sesión
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === 'register' && styles.toggleActive]}
                onPress={() => setMode('register')}
              >
                <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>
                  Registrarse
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fields */}
            <View style={styles.field}>
              <Ionicons name="mail-outline" size={18} color="#4ADE80" style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Correo electrónico"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={18} color="#4ADE80" style={styles.fieldIcon} />
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Contraseña"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#C4C4C4" />
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <View style={styles.field}>
                <Ionicons name="lock-closed-outline" size={18} color="#4ADE80" style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                {loading ? 'Cargando...' : mode === 'login' ? '¡Entrar al campo!' : '¡Crear cuenta!'}
              </Text>
              {!loading && <Ionicons name="football-outline" size={20} color="#0F4C1E" style={styles.btnIcon} />}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  ballContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  ballEmoji: { fontSize: 40 },
  appTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  appSubtitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#4ADE80',
    letterSpacing: -0.5,
    marginTop: -6,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#16A34A' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#D1D5DB' },
  toggleTextActive: { color: '#FFFFFF' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.15)',
    paddingHorizontal: 12,
  },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: '#FFFFFF', fontSize: 15 },
  inputFlex: { flex: 1 },
  eyeBtn: { padding: 8 },
  btn: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: '800', color: '#0F4C1E', letterSpacing: 0.3 },
  btnIcon: { marginLeft: 8 },
})
