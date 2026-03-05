import { View, StyleSheet } from 'react-native'

// Decorative football field lines background
export function FieldLines() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Center circle */}
      <View style={styles.centerCircle} />
      {/* Half line */}
      <View style={styles.halfLine} />
      {/* Corner arcs */}
      <View style={[styles.cornerArc, styles.topLeft]} />
      <View style={[styles.cornerArc, styles.topRight]} />
      <View style={[styles.cornerArc, styles.bottomLeft]} />
      <View style={[styles.cornerArc, styles.bottomRight]} />
      {/* Penalty areas hint */}
      <View style={styles.penaltyTop} />
      <View style={styles.penaltyBottom} />
    </View>
  )
}

// Goal post decoration for menu items
export function GoalPost({ style }: { style?: object }) {
  return <View style={[styles.goalPost, style]} />
}

const BORDER = 'rgba(255,255,255,0.08)'

const styles = StyleSheet.create({
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: BORDER,
    marginTop: -80,
    marginLeft: -80,
  },
  halfLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: BORDER,
  },
  cornerArc: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  topLeft: {
    top: -20,
    left: -20,
    borderRadius: 20,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  topRight: {
    top: -20,
    right: -20,
    borderRadius: 20,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bottomLeft: {
    bottom: -20,
    left: -20,
    borderRadius: 20,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  bottomRight: {
    bottom: -20,
    right: -20,
    borderRadius: 20,
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  penaltyTop: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 80,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: BORDER,
  },
  penaltyBottom: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 80,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: BORDER,
  },
  goalPost: {
    width: 4,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
})
