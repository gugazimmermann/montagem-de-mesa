import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UploadErro } from './storage'

const storageFrom = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    storage: { from: storageFrom },
  },
}))

const CLIENTE = '00978f7b-9737-40b0-a705-831084d1a7d4'
const CATEGORIA = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const ITEM = 'f1e2d3c4-b5a6-9780-1234-56789abcdef0'

function arquivo(tipo: string, tamanho: number, nome = 'foto.png') {
  const blob = new Blob([new Uint8Array(tamanho)], { type: tipo })
  return new File([blob], nome, { type: tipo })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 4000, height: 2000, close() {} })),
  )
})

describe('storage', () => {
  it('valida paths, urls e assinatura', async () => {
    const storage = await import('./storage')
    expect(storage.extrairPathStorage('  ', 'logos')).toBeNull()
    expect(storage.extrairPathStorage('nao-e-url', 'itens')).toBeNull()
    expect(
      storage.extrairPathStorage('https://x.test/sem-storage/logos/a.webp', 'logos'),
    ).toBeNull()
    expect(
      storage.extrairPathStorage(
        `https://x.test/storage/v1/object/public/logos/${CLIENTE}.webp`,
        'logos',
      ),
    ).toBe(`${CLIENTE}.webp`)
    const ruim = `https://x.test/storage/v1/object/public/itens/${CLIENTE}/%E0%A4%A`
    expect(storage.extrairPathStorage(ruim, 'itens')).toBeNull()

    expect(storage.ehPathOuUrlStoragePermitida('')).toBe(false)
    expect(
      storage.ehPathOuUrlStoragePermitida(`${CLIENTE}.webp`, {
        tipo: 'logo',
        clienteId: CLIENTE,
      }),
    ).toBe(true)
    expect(
      storage.ehPathOuUrlStoragePermitida(`${CLIENTE}.webp`, {
        tipo: 'logo',
        clienteId: 'outro-cliente-id-que-nao-bate-uuid',
      }),
    ).toBe(false)
    expect(storage.ehPathOuUrlStoragePermitida('nao', { tipo: 'logo' })).toBe(false)
    expect(
      storage.ehPathOuUrlStoragePermitida(`${CLIENTE}/${CATEGORIA}/${ITEM}.webp`, {
        tipo: 'item',
        clienteId: CLIENTE,
      }),
    ).toBe(true)
    expect(
      storage.ehPathOuUrlStoragePermitida(`${CLIENTE}/${CATEGORIA}/${ITEM}.webp`, {
        tipo: 'item',
        clienteId: '11111111-1111-1111-1111-111111111111',
      }),
    ).toBe(false)
    expect(storage.ehUrlStoragePublicaPermitida(`${CLIENTE}.webp`)).toBe(true)

    expect(storage.exigirUrlStorageOuVazio('  ', 'Logo')).toBe('')
    expect(
      storage.exigirUrlStorageOuVazio(
        `https://x.test/storage/v1/object/sign/itens/${CLIENTE}/${CATEGORIA}/${ITEM}.png?token=1`,
        'Foto',
        { tipo: 'item', clienteId: CLIENTE },
      ),
    ).toBe(`${CLIENTE}/${CATEGORIA}/${ITEM}.png`)
    expect(() =>
      storage.exigirUrlStorageOuVazio('https://evil.test/a.png', 'Logo', {
        clienteId: CLIENTE,
      }),
    ).toThrow(UploadErro)

    storageFrom.mockImplementation(() => ({
      createSignedUrls: vi.fn(async (paths: string[]) => ({
        data: [
          { path: paths[0], signedUrl: 'https://signed.example/a' },
          { path: '', signedUrl: '' },
        ],
        error: null,
      })),
    }))
    expect(
      await storage.resolverUrlAssinada(`${CLIENTE}.webp`, 'logos'),
    ).toBe('https://signed.example/a')
    expect(await storage.resolverUrlAssinada('  ', 'logos')).toBeUndefined()
    expect(await storage.resolverUrlAssinada('https://cdn.example/fora.png', 'logos')).toBe(
      'https://cdn.example/fora.png',
    )
    expect(await storage.resolverUrlAssinada('arquivo-solto', 'logos')).toBeUndefined()

    storageFrom.mockImplementation(() => ({
      createSignedUrls: vi.fn(async () => ({ data: null, error: { message: 'x' } })),
    }))
    expect(await storage.resolverUrlAssinada(`${CLIENTE}.webp`, 'logos')).toBeUndefined()

    storageFrom.mockImplementation((bucket: string) => ({
      createSignedUrls: vi.fn(async (paths: string[]) => ({
        data: paths.map((path) => ({ path, signedUrl: `https://signed/${bucket}/${path}` })),
        error: null,
      })),
    }))
    const lote = await storage.resolverUrlsAssinadasEmLote([
      { valor: `${CLIENTE}.webp`, bucket: 'logos' },
      { valor: `${CLIENTE}/${CATEGORIA}/${ITEM}.webp`, bucket: 'itens' },
      { valor: 'https://cdn.example/solta.png', bucket: 'itens' },
      { valor: '', bucket: 'logos' },
    ])
    expect(lote.get(`${CLIENTE}.webp`)).toContain('https://signed/logos/')
    expect(lote.get('https://cdn.example/solta.png')).toBe('https://cdn.example/solta.png')

    storageFrom.mockImplementation(() => ({
      createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    }))
    const vazio = await storage.resolverUrlsAssinadasEmLote([])
    expect(vazio.size).toBe(0)
  })

  it('comprime e envia logo e item', async () => {
    const storage = await import('./storage')
    const ctx = {
      drawImage() {},
      canvas: {},
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callback(new Blob([new Uint8Array(20)], { type: 'image/webp' }))
    })

    const gif = arquivo('image/gif', 100, 'a.gif')
    expect(await storage.comprimirImagemParaUpload(gif)).toBe(gif)

    const texto = new File(['x'], 'a.txt', { type: 'text/plain' })
    expect(await storage.comprimirImagemParaUpload(texto)).toBe(texto)

    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      throw new Error('bitmap')
    }))
    const png = arquivo('image/png', 100, 'foto.png')
    expect(await storage.comprimirImagemParaUpload(png)).toBe(png)

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 10, height: 10, close() {} })),
    )
    const pequena = arquivo('image/png', 100, 'foto.png')
    expect(await storage.comprimirImagemParaUpload(pequena)).toBe(pequena)

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4000, height: 10, close() {} })),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(await storage.comprimirImagemParaUpload(arquivo('image/jpeg', 100, 'f.jpg'))).toBeInstanceOf(
      File,
    )

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(null)
    })
    expect(
      await storage.comprimirImagemParaUpload(arquivo('image/jpeg', 100, 'f.jpg')),
    ).toBeInstanceOf(File)

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 10, height: 10, close() {} })),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob([new Uint8Array(2000)], { type: 'image/jpeg' }))
    })
    const original = arquivo('image/jpeg', 900, 'grande.jpg')
    expect(
      await storage.comprimirImagemParaUpload(original, {
        preferirWebp: false,
        tamanhoOkBytes: 100,
      }),
    ).toBe(original)
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 4000, height: 10, close() {} })),
    )

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob([new Uint8Array(10)], { type: 'image/webp' }))
    })
    const webp = await storage.comprimirImagemParaUpload(
      arquivo('image/png', 100, 'Logo.PNG'),
      { preferirWebp: true, maxLado: 32 },
    )
    expect(webp.name.endsWith('.webp')).toBe(true)
    expect(webp.type).toBe('image/webp')

    const semExt = await storage.comprimirImagemParaUpload(
      arquivo('image/jpeg', 100, '.jpg'),
      { preferirWebp: true, maxLado: 8 },
    )
    expect(semExt.name.startsWith('imagem.')).toBe(true)

    const upload = vi.fn(async () => ({ error: null }))
    storageFrom.mockImplementation(() => ({ upload }))
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      throw new Error('skip')
    }))
    const logo = arquivo('image/png', 100, 'logo.png')
    expect(await storage.enviarLogoStorage(CLIENTE, logo)).toBe(`${CLIENTE}.png`)

    upload.mockResolvedValueOnce({ error: { message: 'up' } })
    await expect(storage.enviarLogoStorage(CLIENTE, logo)).rejects.toThrow(/logo/)

    await expect(
      storage.enviarLogoStorage(CLIENTE, arquivo('image/png', 3 * 1024 * 1024, 'g.png')),
    ).rejects.toThrow(/2 MB/)
    await expect(
      storage.enviarLogoStorage(CLIENTE, arquivo('text/plain', 10, 'a.txt')),
    ).rejects.toThrow(/Formato/)

    expect(
      await storage.enviarImagemItemStorage(CLIENTE, CATEGORIA, ITEM, logo, 'catalogo'),
    ).toContain('-catalogo.png')
    expect(
      await storage.enviarImagemItemStorage(CLIENTE, CATEGORIA, ITEM, logo),
    ).toBe(`${CLIENTE}/${CATEGORIA}/${ITEM}.png`)
    upload.mockResolvedValueOnce({ error: { message: 'up' } })
    await expect(
      storage.enviarImagemItemStorage(CLIENTE, CATEGORIA, ITEM, logo),
    ).rejects.toThrow(/imagem/)
    await expect(
      storage.enviarImagemItemStorage(
        CLIENTE,
        CATEGORIA,
        ITEM,
        arquivo('image/png', 6 * 1024 * 1024, 'g.png'),
      ),
    ).rejects.toThrow(/5 MB/)
  })
})
