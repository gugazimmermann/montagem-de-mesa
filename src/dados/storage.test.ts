import { describe, expect, it } from 'vitest'
import { extrairPathStorage } from './storage'

const CLIENTE = '00978f7b-9737-40b0-a705-831084d1a7d4'
const CATEGORIA = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const ITEM = 'f1e2d3c4-b5a6-9780-1234-56789abcdef0'

describe('extrairPathStorage', () => {
  it('aceita path novo uuid/uuid/uuid.ext', () => {
    const path = `${CLIENTE}/${CATEGORIA}/${ITEM}.webp`
    expect(extrairPathStorage(path, 'itens')).toBe(path)
  })

  it('aceita path legado uuid/codigo/arquivo.ext', () => {
    const path = `${CLIENTE}/pratoFundo/Prato Fundo Frutos do Mar.webp`
    expect(extrairPathStorage(path, 'itens')).toBe(path)
  })

  it('decodifica %20 em URL public', () => {
    const url =
      `https://tyodiyteqyukvtbsbbuo.supabase.co/storage/v1/object/public/itens/` +
      `${CLIENTE}/pratoFundo/Prato%20Fundo%20Frutos%20do%20Mar.webp`
    expect(extrairPathStorage(url, 'itens')).toBe(
      `${CLIENTE}/pratoFundo/Prato Fundo Frutos do Mar.webp`,
    )
  })

  it('decodifica %20 em URL sign', () => {
    const url =
      `https://tyodiyteqyukvtbsbbuo.supabase.co/storage/v1/object/sign/itens/` +
      `${CLIENTE}/pratoFundo/Prato%20Fundo%20Frutos%20do%20Mar.webp?token=abc`
    expect(extrairPathStorage(url, 'itens')).toBe(
      `${CLIENTE}/pratoFundo/Prato Fundo Frutos do Mar.webp`,
    )
  })

  it('extrai path de logo', () => {
    const path = `${CLIENTE}.webp`
    expect(extrairPathStorage(path, 'logos')).toBe(path)
    expect(
      extrairPathStorage(
        `https://x.supabase.co/storage/v1/object/public/logos/${CLIENTE}.webp`,
        'logos',
      ),
    ).toBe(path)
  })

  it('rejeita bucket errado na URL', () => {
    const url = `https://x.supabase.co/storage/v1/object/public/logos/${CLIENTE}.webp`
    expect(extrairPathStorage(url, 'itens')).toBeNull()
  })
})
