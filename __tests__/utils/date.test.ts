import { formatDate } from '@/utils/date'

describe('formatDate', () => {
  it('formatea una fecha ISO a formato legible en español', () => {
    expect(formatDate('2024-03-15')).toBe('15 Mar 2024')
  })

  it('usa el mes correcto para cada índice', () => {
    const cases = [
      ['2024-01-01', '01 Ene 2024'],
      ['2024-02-14', '14 Feb 2024'],
      ['2024-06-21', '21 Jun 2024'],
      ['2024-12-31', '31 Dic 2024'],
    ]
    cases.forEach(([input, expected]) => {
      expect(formatDate(input)).toBe(expected)
    })
  })

  it('preserva el año correctamente', () => {
    expect(formatDate('2025-07-04')).toBe('04 Jul 2025')
  })

  it('preserva el día con ceros a la izquierda', () => {
    expect(formatDate('2024-09-05')).toBe('05 Sep 2024')
  })
})
