import { useWindowDimensions } from 'react-native'

export function useResponsive() {
  const { width, height } = useWindowDimensions()
  return {
    width,
    height,
    isTablet: width >= 700,
    isDesktop: width >= 1000,
  }
}
