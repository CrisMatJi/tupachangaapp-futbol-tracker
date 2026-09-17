import { useState, useEffect } from 'react'
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
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { FieldLines } from '@/components/FootballBackground'
import { colors, spacing, radius, fontSize, layout } from '@/constants/theme'

WebBrowser.maybeCompleteAuthSession()

export default function AuthScreen() {
  const { user } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (user) router.replace('/home')
  }, [user])

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      if (Platform.OS === 'web') {
        // En web: redirección completa. Supabase redirige de vuelta al origen (sin /home)
        // para que coincida exactamente con la URL en el allowlist de Supabase.
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
        })
        if (error) throw error
        return
      }

      // Nativo (iOS/Android): usar WebBrowser in-app
      // storeClient = Expo Go, standalone/bare = build real
      const isExpoGo = Constants.executionEnvironment === 'storeClient'
      const redirectUrl = makeRedirectUri(
        isExpoGo
          ? { preferLocalhost: true }
          : { scheme: 'tupachangaapp', path: 'auth' }
      )

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      })
      if (error) throw error
      if (!data?.url) throw new Error('No se pudo obtener la URL de Google')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

      if (result.type === 'success') {
        const url = result.url

        // Flujo PKCE: ?code=...
        const codeMatch = url.match(/[?&]code=([^&#]*)/)
        if (codeMatch?.[1]) {
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(codeMatch[1])
          if (sessionError) throw sessionError
          if (sessionData.session) { router.replace('/home'); return }
        }

        // Flujo implícito: #access_token=...&refresh_token=...
        const fragment = url.split('#')[1] ?? ''
        const params = Object.fromEntries(fragment.split('&').map(p => p.split('=')))
        if (params.access_token && params.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          })
          if (sessionError) throw sessionError
          router.replace('/home')
          return
        }

        // Fallback: comprobar sesión ya establecida
        const { data: { session } } = await supabase.auth.getSession()
        if (session) router.replace('/home')
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error al iniciar sesión con Google')
    } finally {
      setGoogleLoading(false)
    }
  }

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
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        router.replace('/home')
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw error
        if (data.session) {
          // Confirmación de email desactivada → sesión inmediata
          router.replace('/home')
        } else {
          // Confirmación de email activada → avisar al usuario
          Alert.alert(
            '¡Registro exitoso!',
            'Te hemos enviado un email de confirmación. Confírmalo y luego inicia sesión.',
            [{ text: 'OK', onPress: () => setMode('login') }]
          )
        }
      }
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
              <MaterialCommunityIcons name="soccer" size={64} color={colors.accent.primary} />
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
              <Ionicons name="mail-outline" size={18} color={colors.accent.light} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Correo electrónico"
                placeholderTextColor={colors.text.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.accent.light} style={styles.fieldIcon} />
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Contraseña"
                placeholderTextColor={colors.text.muted}
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
                <Ionicons name="lock-closed-outline" size={18} color={colors.accent.light} style={styles.fieldIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor={colors.text.muted}
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
              {!loading && <MaterialCommunityIcons name="soccer" size={20} color="#0F4C1E" style={styles.btnIcon} />}
            </TouchableOpacity>

            {/* Divisor */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o continúa con</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleText}>
                {googleLoading ? 'Cargando...' : 'Continuar con Google'}
              </Text>
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
    width: '100%',
    maxWidth: layout.maxWidthForm,
    alignSelf: 'center',
  },
  header: { alignItems: 'center', marginBottom: 32 },
  ballContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ballEmoji: { fontSize: 40 },
  appTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text.primary,
    letterSpacing: -1,
  },
  appSubtitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.accent.light,
    letterSpacing: -0.5,
    marginTop: -6,
  },
  tagline: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.xxl,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.accent.dark },
  toggleText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text.secondary },
  toggleTextActive: { color: colors.text.primary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
    paddingHorizontal: spacing.md,
  },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: colors.text.primary, fontSize: fontSize.lg },
  inputFlex: { flex: 1 },
  eyeBtn: { padding: 8 },
  btn: {
    backgroundColor: colors.accent.primary,
    borderRadius: radius.lg,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: fontSize.xl, fontWeight: '800', color: '#0F4C1E', letterSpacing: 0.3 },
  btnIcon: { marginLeft: 8 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dividerText: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
    marginHorizontal: 10,
  },
  googleBtn: {
    backgroundColor: colors.text.primary,
    borderRadius: radius.lg,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleG: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#1F1F1F',
  },
})
