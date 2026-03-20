import { POSITIONS, POSITIONS_INFO, getPositionInfo } from '@/utils/positions'

describe('POSITIONS', () => {
  it('contiene exactamente las 4 posiciones', () => {
    expect(POSITIONS).toHaveLength(4)
    const keys = POSITIONS.map((p) => p.key)
    expect(keys).toEqual(expect.arrayContaining(['POR', 'DEF', 'MD', 'AT']))
  })

  it('cada posición tiene emoji, label y color', () => {
    POSITIONS.forEach((pos) => {
      expect(pos.emoji).toBeTruthy()
      expect(pos.label).toBeTruthy()
      expect(pos.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })
})

describe('POSITIONS_INFO', () => {
  it('tiene entrada para cada posición', () => {
    expect(POSITIONS_INFO['POR']).toBeDefined()
    expect(POSITIONS_INFO['DEF']).toBeDefined()
    expect(POSITIONS_INFO['MD']).toBeDefined()
    expect(POSITIONS_INFO['AT']).toBeDefined()
  })

  it('los emojis coinciden con POSITIONS', () => {
    POSITIONS.forEach((pos) => {
      expect(POSITIONS_INFO[pos.key].emoji).toBe(pos.emoji)
      expect(POSITIONS_INFO[pos.key].color).toBe(pos.color)
    })
  })
})

describe('getPositionInfo', () => {
  it('devuelve info correcta para posiciones válidas', () => {
    expect(getPositionInfo('POR')).toEqual(POSITIONS_INFO['POR'])
    expect(getPositionInfo('AT')).toEqual(POSITIONS_INFO['AT'])
  })

  it('devuelve null para posición undefined', () => {
    expect(getPositionInfo(undefined)).toBeNull()
  })

  it('devuelve null para posición null', () => {
    expect(getPositionInfo(null)).toBeNull()
  })

  it('devuelve null para una posición inválida', () => {
    expect(getPositionInfo('INVALIDA')).toBeNull()
  })
})
