/**
 * Tests del servicio de jugadores.
 * Se mockea @/lib/supabase para no necesitar una conexión real.
 *
 * NOTA: jest.mock() hoisting requiere que el factory no referencie
 * variables externas al factory. Por eso se definen inline.
 */
jest.mock('@/lib/supabase', () => {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'ilike', 'order', 'limit', 'single']
  methods.forEach((m) => { chain[m] = jest.fn().mockReturnValue(chain) })
  return {
    supabase: { from: jest.fn().mockReturnValue(chain) },
    __chain: chain,
  }
})

import { supabase } from '@/lib/supabase'
import {
  fetchPlayersByName,
  playerNameExists,
  insertPlayer,
  deletePlayer,
} from '@/services/players'

const getChain = () => (require('@/lib/supabase') as any).__chain as Record<string, jest.Mock>

const RAW_PLAYER = {
  id: 'player_1',
  user_id: 'user_1',
  name: 'Messi',
  skill: 5,
  position: 'AT',
  created_at: '2024-01-01',
}

const MAPPED_PLAYER = {
  id: 'player_1',
  userId: 'user_1',
  name: 'Messi',
  skill: 5,
  position: 'AT',
  createdAt: '2024-01-01',
}

beforeEach(() => {
  jest.clearAllMocks()
  const chain = getChain()
  Object.values(chain).forEach((m) => m.mockReturnValue(chain))
  ;(supabase.from as jest.Mock).mockReturnValue(chain)
})

describe('fetchPlayersByName', () => {
  it('mapea los datos de Supabase al modelo Player', async () => {
    const chain = getChain()
    chain.order.mockResolvedValueOnce({ data: [RAW_PLAYER], error: null })
    const result = await fetchPlayersByName('user_1')
    expect(result).toEqual([MAPPED_PLAYER])
  })

  it('devuelve array vacío si data es null', async () => {
    const chain = getChain()
    chain.order.mockResolvedValueOnce({ data: null, error: null })
    const result = await fetchPlayersByName('user_1')
    expect(result).toEqual([])
  })

  it('lanza error si Supabase devuelve error', async () => {
    const chain = getChain()
    chain.order.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })
    await expect(fetchPlayersByName('user_1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('playerNameExists', () => {
  it('devuelve true cuando ya existe el nombre', async () => {
    const chain = getChain()
    chain.limit.mockResolvedValueOnce({ data: [{ id: 'player_1' }], error: null })
    const exists = await playerNameExists('user_1', 'Messi')
    expect(exists).toBe(true)
  })

  it('devuelve false cuando no existe el nombre', async () => {
    const chain = getChain()
    chain.limit.mockResolvedValueOnce({ data: [], error: null })
    const exists = await playerNameExists('user_1', 'Ronaldo')
    expect(exists).toBe(false)
  })

  it('devuelve false si data es null', async () => {
    const chain = getChain()
    chain.limit.mockResolvedValueOnce({ data: null, error: null })
    const exists = await playerNameExists('user_1', 'Ronaldo')
    expect(exists).toBe(false)
  })
})

describe('insertPlayer', () => {
  it('llama a supabase.from("players") con los datos correctos', async () => {
    const chain = getChain()
    chain.insert.mockResolvedValueOnce({ error: null })
    await insertPlayer('user_1', 'Messi', 5, 'AT')
    expect(supabase.from).toHaveBeenCalledWith('players')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user_1', name: 'Messi', skill: 5, position: 'AT' })
    )
  })

  it('lanza error si Supabase falla', async () => {
    const chain = getChain()
    chain.insert.mockResolvedValueOnce({ error: { message: 'Insert failed' } })
    await expect(insertPlayer('user_1', 'Messi', 5, 'AT')).rejects.toMatchObject({
      message: 'Insert failed',
    })
  })

  it('recorta espacios del nombre', async () => {
    const chain = getChain()
    chain.insert.mockResolvedValueOnce({ error: null })
    await insertPlayer('user_1', '  Messi  ', 5, 'AT')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Messi' })
    )
  })
})

describe('deletePlayer', () => {
  it('usa la tabla correcta y el id correcto', async () => {
    const chain = getChain()
    chain.eq.mockResolvedValueOnce({ error: null })
    await deletePlayer('player_1')
    expect(supabase.from).toHaveBeenCalledWith('players')
    expect(chain.eq).toHaveBeenCalledWith('id', 'player_1')
  })
})

