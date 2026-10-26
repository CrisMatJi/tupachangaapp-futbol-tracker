/**
 * Utilidades cross-platform para lo que en react-native-web no funciona igual:
 *  - Alert.alert  → en web es un no-op (los botones/callbacks nunca se ejecutan)
 *  - Share.share  → en web depende de navigator.share (no existe en la mayoría de navegadores de escritorio)
 *  - URL pública  → en web hay que respetar el baseUrl de GitHub Pages
 */
import { Alert, Platform, Share, Linking, type AlertButton } from 'react-native'
import Constants from 'expo-constants'

const isWeb = Platform.OS === 'web'

// ─────────────────────────────────────────────────────────────
// Alertas
// ─────────────────────────────────────────────────────────────

/**
 * Sustituto de Alert.alert que también funciona en web.
 *  - 0-1 botones           → window.alert y ejecuta el onPress del botón
 *  - 1 acción + cancelar   → window.confirm
 *  - Varias opciones       → window.prompt numerado
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (!isWeb) {
    Alert.alert(title, message, buttons)
    return
  }
  if (typeof window === 'undefined') return

  const text = message ? `${title}\n\n${message}` : title
  const all = buttons ?? []
  const cancel = all.find((b) => b.style === 'cancel')
  const actions = all.filter((b) => b.style !== 'cancel')

  if (actions.length === 0) {
    window.alert(text)
    cancel?.onPress?.()
    return
  }

  if (actions.length === 1) {
    if (cancel) {
      if (window.confirm(text)) actions[0].onPress?.()
      else cancel.onPress?.()
    } else {
      window.alert(text)
      actions[0].onPress?.()
    }
    return
  }

  const options = actions.map((b, i) => `${i + 1}. ${b.text}`).join('\n')
  const answer = window.prompt(`${text}\n\n${options}\n\nEscribe el número de la opción:`, '1')
  const idx = answer ? parseInt(answer, 10) - 1 : -1
  if (idx >= 0 && idx < actions.length) actions[idx].onPress?.()
  else cancel?.onPress?.()
}

// ─────────────────────────────────────────────────────────────
// Compartir
// ─────────────────────────────────────────────────────────────

/**
 * Comparte texto. En web usa la Web Share API si existe (móvil) y,
 * si no (escritorio), copia al portapapeles y avisa.
 */
export async function shareText(message: string): Promise<void> {
  if (!isWeb) {
    try { await Share.share({ message }) } catch {}
    return
  }
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined
  if (nav?.share) {
    try {
      await nav.share({ text: message })
      return
    } catch (e: any) {
      if (e?.name === 'AbortError') return // el usuario cerró el diálogo
    }
  }
  try {
    await nav.clipboard.writeText(message)
    window.alert('Texto copiado al portapapeles. Pégalo en WhatsApp o donde quieras.')
  } catch {
    window.prompt('Copia este texto:', message)
  }
}

/** Abre WhatsApp con el texto. En web usa wa.me (WhatsApp Web / app). */
export async function shareWhatsApp(message: string): Promise<void> {
  const text = encodeURIComponent(message)
  if (isWeb) {
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener')
    return
  }
  const url = `whatsapp://send?text=${text}`
  if (await Linking.canOpenURL(url)) await Linking.openURL(url)
  else await shareText(message)
}

// ─────────────────────────────────────────────────────────────
// URL pública de la app
// ─────────────────────────────────────────────────────────────

/**
 * URL base pública de la app, sin barra final.
 * En web se calcula a partir del dominio actual + baseUrl de app.json
 * (p. ej. https://crismatji.github.io/tupachangaapp-futbol-tracker),
 * así funciona igual en GitHub Pages, Netlify o localhost.
 */
export function getAppUrl(): string {
  if (isWeb && typeof window !== 'undefined') {
    const baseUrl = ((Constants.expoConfig?.experiments as any)?.baseUrl ?? '') as string
    return `${window.location.origin}${baseUrl}`.replace(/\/$/, '')
  }
  return (process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:8081').replace(/\/$/, '')
}
