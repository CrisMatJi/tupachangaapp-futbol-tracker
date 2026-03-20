/** Formatea una fecha ISO (YYYY-MM-DD) a un string legible en español. */
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}
