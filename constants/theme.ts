/**
 * Tema central de tuPachanga.
 * Todos los colores, espaciados y radios de la app provienen de aquí.
 * De esta forma, cambiar el tema sólo requiere editar este archivo.
 */

export const colors = {
  // Fondos
  bg: {
    primary: '#0A3A17',       // fondo principal (verde oscuro)
    card: '#111827',           // tarjetas / modales
    cardActive: 'rgba(34,197,94,0.10)',
    cardActive2: 'rgba(34,197,94,0.12)',
    overlay: 'rgba(10,58,23,0.80)',   // overlay sobre ImageBackground
    overlayMenu: 'rgba(10,58,23,0.78)',
    section: 'rgba(255,255,255,0.04)',
    deep: '#0D1F0D',
    deeper: '#166534',
    input: '#1F2937',
  },

  // Acento principal (verde)
  accent: {
    primary: '#22C55E',
    light: '#4ADE80',
    dark: '#16A34A',
    muted: 'rgba(74,222,128,0.10)',
    border: 'rgba(74,222,128,0.15)',
    borderStrong: 'rgba(74,222,128,0.30)',
  },

  // Texto
  text: {
    primary: '#FFFFFF',
    secondary: '#D1D5DB',
    muted: '#9CA3AF',
    accent: '#4ADE80',
    inverse: '#0A3A17',   // texto sobre fondo verde (p.ej. botón primario)
  },

  // Bordes genéricos
  border: {
    subtle: 'rgba(255,255,255,0.07)',
    medium: 'rgba(255,255,255,0.10)',
  },

  // Equipos
  team: {
    A: '#EF4444',
    B: '#3B82F6',
  },

  // Estrellas de habilidad
  star: {
    active: '#F59E0B',
    inactive: '#374151',
  },

  // Colores de estado / semánticos
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    purple: '#8B5CF6',
  },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 20,
  round: 9999,
} as const

export const fontSize = {
  xs: 10,
  sm: 11,
  base: 13,
  md: 14,
  lg: 15,
  xl: 16,
  xxl: 18,
  xxxl: 20,
} as const

// Anchos máximos de contenido en pantallas anchas (tablet/desktop),
// para que no se estire borde a borde.
export const layout = {
  maxWidthForm: 480,
  maxWidthContent: 1100,
} as const
