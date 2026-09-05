import { describe, it, expect, vi, beforeEach } from 'vitest'

/*
 * The client is a module-level singleton built from environment variables, so
 * it is mocked rather than configured. What is worth testing here is the part
 * that decides what to send and what to keep, not Supabase's own storage API.
 */
const storage = {
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
}

vi.mock('./supabase', () => ({
  supabase: { storage: { from: () => storage } },
}))

const { BUCKET, forgetSignedUrls, photosAvailable, photoUrl, removePhoto, uploadPhoto } =
  await import('./photos')

const file = (type: string, bytes = 100) =>
  new File([new Uint8Array(bytes)], `x.${type.split('/')[1]}`, { type })

beforeEach(() => {
  vi.clearAllMocks()
  forgetSignedUrls()
})

describe('whether the app offers a photo at all', () => {
  it('asks storage rather than assuming the bucket is there', async () => {
    storage.list.mockResolvedValue({ error: null })
    expect(await photosAvailable()).toBe(true)
  })

  it('says no when nobody has run the SQL yet', async () => {
    // The control disappears rather than failing on use. A file picker that
    // always errored would read as a broken app rather than as setup nobody
    // has done.
    storage.list.mockResolvedValue({ error: { message: 'Bucket not found' } })
    expect(await photosAvailable()).toBe(false)
  })
})

describe('storing one', () => {
  it('refuses anything that is not an image the bucket accepts', async () => {
    const out = await uploadPhoto('recipe-1', file('application/pdf'))
    expect(out).toEqual({ ok: false, reason: expect.stringContaining('JPEG') })
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('files it under the recipe, with a name of its own', async () => {
    storage.upload.mockResolvedValue({ error: null })
    const out = await uploadPhoto('recipe-1', file('image/jpeg'))

    expect(out.ok).toBe(true)
    // Under the recipe so a bucket listing is legible, and uniquely named so
    // replacing a photo writes a new object rather than overwriting one that
    // other devices have already signed a URL for.
    expect(out.ok && out.path).toMatch(/^recipe-1\/[0-9a-f-]{36}\.\w+$/)
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringContaining('recipe-1/'),
      expect.anything(),
      expect.objectContaining({ upsert: false }),
    )
  })

  it('reports a refusal from storage rather than swallowing it', async () => {
    storage.upload.mockResolvedValue({ error: { message: 'Payload too large' } })
    expect(await uploadPhoto('recipe-1', file('image/png')))
      .toEqual({ ok: false, reason: 'Payload too large' })
  })

  it('takes one out of the bucket by path', async () => {
    storage.remove.mockResolvedValue({ error: null })
    await removePhoto('recipe-1/abc.webp')
    expect(storage.remove).toHaveBeenCalledWith(['recipe-1/abc.webp'])
  })
})

describe('showing one', () => {
  it('signs a URL and then holds on to it', async () => {
    storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/y' }, error: null })

    expect(await photoUrl('a/b.webp')).toBe('https://x/y')
    expect(await photoUrl('a/b.webp')).toBe('https://x/y')
    // Without the cache the shelf would sign every visible card on every
    // render, which is a request per card per keystroke in the search box.
    expect(storage.createSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('has no URL rather than a broken one when signing is refused', async () => {
    storage.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'nope' } })
    expect(await photoUrl('a/b.webp')).toBeNull()
  })

  it('signs against the bucket the SQL creates', () => {
    expect(BUCKET).toBe('recipe-photos')
  })
})
