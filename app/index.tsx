import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { router } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAuth } from '@/hooks/useAuth'

export default function Index() {
  const { user, loading } = useAuth()

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.6)).current
  const ballBounce = useRef(new Animated.Value(0)).current
  const titleSlide = useRef(new Animated.Value(30)).current

  useEffect(() => {
    // Entry animation: fade + scale in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(titleSlide, {
        toValue: 0,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    // Ball bounce loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(ballBounce, {
          toValue: -18,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ballBounce, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  useEffect(() => {
    if (loading) return
    // Small delay so animation is visible
    const timeout = setTimeout(() => {
      if (user) {
        router.replace('/home')
      } else {
        router.replace('/auth')
      }
    }, 800)
    return () => clearTimeout(timeout)
  }, [user, loading])

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Ball */}
        <Animated.View style={{ transform: [{ translateY: ballBounce }] }}>
          <MaterialCommunityIcons name="soccer" size={90} color="#22C55E" />
        </Animated.View>

        {/* App name */}
        <Animated.View style={{ transform: [{ translateY: titleSlide }], opacity: fadeAnim }}>
          <Text style={styles.title}>tu<Text style={styles.titleAccent}>Pachanga</Text></Text>
          <Text style={styles.subtitle}>Disfruta del fútbol</Text>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a3d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -1,
  },
  titleAccent: {
    color: '#22C55E',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 1,
  },
})
