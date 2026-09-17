/**
 * TeamsBoard
 * ----------
 * Tablero de dos equipos (A / B) con drag-and-drop para mover o reordenar
 * jugadores entre ellos. Componente controlado y autocontenido: no guarda
 * su propia copia de la fuente de verdad, sólo el estado visual necesario
 * para que el gesto de arrastre se sienta fluido (posición animada de la
 * fila que se está arrastrando).
 *
 * Uso:
 *   <TeamsBoard teamA={teamA} teamB={teamB} onChange={(a, b) => ...} />
 *
 * Notas de integración:
 * - Envuelve su propio árbol en `GestureHandlerRootView` para que los
 *   gestos funcionen sin depender de que el layout raíz de la app añada
 *   uno (ver app/_layout.tsx, que hoy no lo tiene). Si la app ya tiene un
 *   GestureHandlerRootView en el root, este anidado es inofensivo.
 * - Detección de destino de drop: en `onLayout` de cada fila y de cada
 *   tarjeta de equipo se mide su posición absoluta en pantalla (View.measure,
 *   soportado también por react-native-web) y se guarda en un ref. Al
 *   soltar (onEnd del Pan), se compara `event.absoluteX/absoluteY` contra
 *   esas cajas: si cae dentro de una fila, se inserta antes/después según
 *   la mitad vertical de esa fila; si cae en el área vacía de una tarjeta,
 *   se añade al final; si no cae en ninguna, se cancela (snap-back visual,
 *   sin llamar a onChange).
 */
import React, { useCallback, useRef, useState } from 'react'
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import type { Player, Team } from '@/types'
import { POSITIONS_INFO } from '@/utils/positions'
import { avgSkill } from '@/utils/teamBalance'
import { useResponsive } from '@/hooks/useResponsive'
import { colors, spacing, radius, fontSize } from '@/constants/theme'

export type TeamsBoardProps = {
  teamA: Player[]
  teamB: Player[]
  onChange: (nextTeamA: Player[], nextTeamB: Player[]) => void
}

type Rect = { x: number; y: number; width: number; height: number }

type DropTarget = { team: Team; index: number }

function rowKey(team: Team, playerId: string) {
  return `${team}:${playerId}`
}

function pointInRect(x: number, y: number, r: Rect) {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function TeamsBoard({ teamA, teamB, onChange }: TeamsBoardProps) {
  const { isTablet } = useResponsive()
  const [draggingKey, setDraggingKey] = useState<string | null>(null)

  // Refs vivos con los arrays actuales, para que los callbacks de gesto
  // (creados en el render de cada fila) siempre lean el estado más reciente.
  const teamARef = useRef(teamA)
  const teamBRef = useRef(teamB)
  teamARef.current = teamA
  teamBRef.current = teamB

  // Cajas medidas en coordenadas absolutas de pantalla (window), para
  // comparar contra event.absoluteX/absoluteY del gesto Pan.
  const rowRects = useRef<Record<string, Rect>>({})
  const rowNodes = useRef<Record<string, View | null>>({})
  const cardRects = useRef<Record<Team, Rect | null>>({ A: null, B: null })
  const cardNodes = useRef<Record<Team, View | null>>({ A: null, B: null })

  const measureRow = useCallback((key: string) => {
    const node = rowNodes.current[key]
    if (!node) return
    node.measure((_x, _y, width, height, pageX, pageY) => {
      rowRects.current[key] = { x: pageX, y: pageY, width, height }
    })
  }, [])

  const measureCard = useCallback((team: Team) => {
    const node = cardNodes.current[team]
    if (!node) return
    node.measure((_x, _y, width, height, pageX, pageY) => {
      cardRects.current[team] = { x: pageX, y: pageY, width, height }
    })
  }, [])

  const registerRowNode = useCallback((key: string, node: View | null) => {
    rowNodes.current[key] = node
  }, [])

  const registerCardNode = useCallback((team: Team, node: View | null) => {
    cardNodes.current[team] = node
  }, [])

  const handleRowLayout = useCallback(
    (key: string) => (_e: LayoutChangeEvent) => measureRow(key),
    [measureRow]
  )

  const handleCardLayout = useCallback(
    (team: Team) => (_e: LayoutChangeEvent) => measureCard(team),
    [measureCard]
  )

  const findDropTarget = useCallback((absoluteX: number, absoluteY: number, excludeKey: string): DropTarget | null => {
    // 1) ¿Cae sobre otra fila?
    for (const [key, rect] of Object.entries(rowRects.current)) {
      if (key === excludeKey || !rect) continue
      if (pointInRect(absoluteX, absoluteY, rect)) {
        const [team, playerId] = key.split(':') as [Team, string]
        const arr = team === 'A' ? teamARef.current : teamBRef.current
        const idx = arr.findIndex((p) => p.id === playerId)
        if (idx === -1) continue
        const midY = rect.y + rect.height / 2
        const insertIndex = absoluteY < midY ? idx : idx + 1
        return { team, index: insertIndex }
      }
    }
    // 2) ¿Cae en el área vacía de alguna tarjeta? -> al final
    for (const team of ['A', 'B'] as Team[]) {
      const rect = cardRects.current[team]
      if (rect && pointInRect(absoluteX, absoluteY, rect)) {
        const arr = team === 'A' ? teamARef.current : teamBRef.current
        return { team, index: arr.length }
      }
    }
    return null
  }, [])

  const handleDrop = useCallback(
    (sourceTeam: Team, playerId: string, absoluteX: number, absoluteY: number) => {
      const excludeKey = rowKey(sourceTeam, playerId)
      const target = findDropTarget(absoluteX, absoluteY, excludeKey)
      if (!target) return // fuera de cualquier zona -> sin cambios (snap back visual ya gestionado por el gesto)

      const sourceArr = [...(sourceTeam === 'A' ? teamARef.current : teamBRef.current)]
      const srcIdx = sourceArr.findIndex((p) => p.id === playerId)
      if (srcIdx === -1) return
      const [moved] = sourceArr.splice(srcIdx, 1)

      if (sourceTeam === target.team) {
        let insertIdx = target.index
        if (srcIdx < insertIdx) insertIdx -= 1
        insertIdx = clamp(insertIdx, 0, sourceArr.length)
        sourceArr.splice(insertIdx, 0, moved)
        const nextA = sourceTeam === 'A' ? sourceArr : teamARef.current
        const nextB = sourceTeam === 'B' ? sourceArr : teamBRef.current
        onChange(nextA, nextB)
      } else {
        const targetArr = [...(target.team === 'A' ? teamARef.current : teamBRef.current)]
        const insertIdx = clamp(target.index, 0, targetArr.length)
        targetArr.splice(insertIdx, 0, moved)
        const nextA = sourceTeam === 'A' ? sourceArr : target.team === 'A' ? targetArr : teamARef.current
        const nextB = sourceTeam === 'B' ? sourceArr : target.team === 'B' ? targetArr : teamBRef.current
        onChange(nextA, nextB)
      }
    },
    [findDropTarget, onChange]
  )

  const handleDragStart = useCallback((key: string) => setDraggingKey(key), [])
  const handleDragEnd = useCallback(() => setDraggingKey(null), [])

  return (
    <GestureHandlerRootView style={styles.rootView}>
      <View style={[styles.board, isTablet ? styles.boardRow : styles.boardColumn]}>
        <TeamCard
          team="A"
          players={teamA}
          label="EQUIPO A"
          accent={colors.team.A}
          draggingKey={draggingKey}
          registerCardNode={registerCardNode}
          handleCardLayout={handleCardLayout}
          registerRowNode={registerRowNode}
          handleRowLayout={handleRowLayout}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
        />

        <View style={[styles.vsDivider, isTablet && styles.vsDividerVertical]}>
          <View style={[styles.vsLine, isTablet && styles.vsLineVertical]} />
          <View style={[styles.vsCircle, isTablet && styles.vsCircleVertical]}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={[styles.vsLine, isTablet && styles.vsLineVertical]} />
        </View>

        <TeamCard
          team="B"
          players={teamB}
          label="EQUIPO B"
          accent={colors.team.B}
          draggingKey={draggingKey}
          registerCardNode={registerCardNode}
          handleCardLayout={handleCardLayout}
          registerRowNode={registerRowNode}
          handleRowLayout={handleRowLayout}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
        />
      </View>
    </GestureHandlerRootView>
  )
}

type TeamCardProps = {
  team: Team
  players: Player[]
  label: string
  accent: string
  draggingKey: string | null
  registerCardNode: (team: Team, node: View | null) => void
  handleCardLayout: (team: Team) => (e: LayoutChangeEvent) => void
  registerRowNode: (key: string, node: View | null) => void
  handleRowLayout: (key: string) => (e: LayoutChangeEvent) => void
  onDragStart: (key: string) => void
  onDragEnd: () => void
  onDrop: (sourceTeam: Team, playerId: string, absoluteX: number, absoluteY: number) => void
}

function TeamCard({
  team,
  players,
  label,
  accent,
  draggingKey,
  registerCardNode,
  handleCardLayout,
  registerRowNode,
  handleRowLayout,
  onDragStart,
  onDragEnd,
  onDrop,
}: TeamCardProps) {
  return (
    <View
      style={[styles.teamCard, { borderTopColor: accent }]}
      collapsable={false}
      ref={(node) => registerCardNode(team, node)}
      onLayout={handleCardLayout(team)}
    >
      <View style={styles.teamHeader}>
        <View style={styles.teamHeaderLeft}>
          <View style={[styles.teamDot, { backgroundColor: accent }]} />
          <Text style={styles.teamHeaderText}>{label}</Text>
        </View>
        <Text style={styles.teamAvg}>Media: {avgSkill(players)}</Text>
      </View>

      {players.map((player, index) => {
        const key = rowKey(team, player.id)
        return (
          <PlayerRow
            key={player.id}
            player={player}
            team={team}
            index={index}
            rowKeyStr={key}
            isDragging={draggingKey === key}
            registerRowNode={registerRowNode}
            onLayoutRow={handleRowLayout(key)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
          />
        )
      })}
    </View>
  )
}

type PlayerRowProps = {
  player: Player
  team: Team
  index: number
  rowKeyStr: string
  isDragging: boolean
  registerRowNode: (key: string, node: View | null) => void
  onLayoutRow: (e: LayoutChangeEvent) => void
  onDragStart: (key: string) => void
  onDragEnd: () => void
  onDrop: (sourceTeam: Team, playerId: string, absoluteX: number, absoluteY: number) => void
}

function PlayerRow({
  player,
  team,
  rowKeyStr,
  isDragging,
  registerRowNode,
  onLayoutRow,
  onDragStart,
  onDragEnd,
  onDrop,
}: PlayerRowProps) {
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)

  const pos = player.position ? POSITIONS_INFO[player.position] : null

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(150)
    .onStart(() => {
      scale.value = withSpring(1.06)
      runOnJS(onDragStart)(rowKeyStr)
    })
    .onUpdate((e) => {
      translateX.value = e.translationX
      translateY.value = e.translationY
    })
    .onEnd((e) => {
      runOnJS(onDrop)(team, player.id, e.absoluteX, e.absoluteY)
    })
    .onFinalize(() => {
      translateX.value = withSpring(0)
      translateY.value = withSpring(0)
      scale.value = withSpring(1)
      runOnJS(onDragEnd)()
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <View
      ref={(node) => registerRowNode(rowKeyStr, node)}
      onLayout={onLayoutRow}
      collapsable={false}
      style={[styles.rowWrapper, isDragging && styles.rowWrapperDragging]}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.teamPlayerRow,
            isDragging && styles.teamPlayerRowDragging,
            animatedStyle,
          ]}
        >
          <MaterialCommunityIcons
            name={(pos ? pos.iconName : 'soccer') as any}
            size={16}
            color={pos ? pos.color : colors.accent.light}
            style={styles.rowIcon}
          />
          <Text style={styles.teamPlayerName}>{player.name}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Text
                key={i}
                style={[
                  styles.star,
                  { color: i <= player.skill ? colors.star.active : colors.star.inactive },
                ]}
              >
                ★
              </Text>
            ))}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  rootView: {
    // No fuerza flex:1 rígido: se adapta al contenedor donde se monte
    // (pensado para vivir dentro de un ScrollView de la pantalla llamadora).
    width: '100%',
  },
  board: {
    width: '100%',
    gap: spacing.md,
  },
  boardColumn: {
    flexDirection: 'column',
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  teamCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderTopWidth: 3,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg - 2,
    backgroundColor: colors.bg.section,
    borderTopLeftRadius: radius.xl - 3,
    borderTopRightRadius: radius.xl - 3,
  },
  teamHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: radius.round,
  },
  teamHeaderText: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.text.primary,
  },
  teamAvg: {
    fontSize: fontSize.base,
    color: colors.star.active,
    fontWeight: '700',
  },
  rowWrapper: {
    // zIndex eleva la fila arrastrada por encima de las demás filas
    // hermanas dentro de la misma tarjeta.
    zIndex: 0,
  },
  rowWrapperDragging: {
    zIndex: 100,
    elevation: 8,
  },
  teamPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  teamPlayerRowDragging: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  rowIcon: {
    marginRight: spacing.sm,
  },
  teamPlayerName: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: '500',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  star: {
    fontSize: fontSize.xs,
  },
  vsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  vsDividerVertical: {
    flexDirection: 'column',
    marginVertical: 0,
    marginHorizontal: spacing.xs,
    alignSelf: 'stretch',
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.medium,
  },
  vsLineVertical: {
    width: 1,
    height: undefined,
  },
  vsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.deeper,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.accent.primary,
  },
  vsCircleVertical: {
    marginHorizontal: 0,
    marginVertical: spacing.md,
  },
  vsText: {
    fontSize: fontSize.sm,
    fontWeight: '900',
    color: colors.accent.primary,
  },
})
