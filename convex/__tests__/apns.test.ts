import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('convex/server', () => ({
  httpActionGeneric: (handler: unknown) => handler,
}))

import { sendApnsPush } from '../apns'

type HttpActionHandler = (ctx: unknown, request: Request) => Promise<Response>

const handler = sendApnsPush as unknown as HttpActionHandler

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.APNS_JWT
  delete process.env.APNS_TOPIC
})

describe('APNS HTTP action', () => {
  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    })

    const response = await handler({}, request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Invalid JSON body' })
  })

  it('returns 400 when body is not a JSON object', async () => {
    const request = new Request('http://localhost/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('plain string'),
    })

    const response = await handler({}, request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Request body must be a JSON object' })
  })

  it('returns 400 when required fields are missing', async () => {
    const request = new Request('http://localhost/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceToken: 'abc123',
        body: 'message body',
      }),
    })

    const response = await handler({}, request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Missing required field: title' })
  })

  it('sends APNS request and returns success with apnsId', async () => {
    process.env.APNS_JWT = 'test-jwt'
    process.env.APNS_TOPIC = 'com.example.test'

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'apns-id': 'apns-123' },
      })
    )

    const request = new Request('http://localhost/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceToken: 'device token/with space',
        title: 'Hello',
        body: 'World',
        data: { key: 'value' },
      }),
    })

    const response = await handler({}, request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ success: true, apnsId: 'apns-123' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toBe('https://api.sandbox.push.apple.com/3/device/device%20token%2Fwith%20space')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-jwt',
      'Content-Type': 'application/json',
      'apns-topic': 'com.example.test',
      'apns-push-type': 'alert',
    })

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      aps: {
        alert: {
          title: 'Hello',
          body: 'World',
        },
        sound: 'default',
      },
      key: 'value',
    })
  })

  it('returns 500 with APNS error details when upstream fails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ reason: 'BadDeviceToken' }), {
        status: 400,
        statusText: 'Bad Request',
      })
    )

    const request = new Request('http://localhost/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceToken: 'abc123',
        title: 'Hi',
        body: 'There',
      }),
    })

    const response = await handler({}, request)
    const payload = await response.json()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(response.status).toBe(500)
    expect(payload).toEqual({
      error: 'APNS request failed',
      details: {
        status: 400,
        statusText: 'Bad Request',
        body: '{"reason":"BadDeviceToken"}',
      },
    })
  })

  it('returns 400 when data field contains non-string values', async () => {
    const request = new Request('http://localhost/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceToken: 'abc123',
        title: 'Hi',
        body: 'There',
        data: { count: 1, ok: 'yes' },
      }),
    })

    const response = await handler({}, request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Invalid optional field: data must be an object of string values',
    })
  })

  it('returns 500 with error details when APNS fetch throws', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    const request = new Request('http://localhost/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceToken: 'abc123',
        title: 'Hi',
        body: 'There',
      }),
    })

    const response = await handler({}, request)
    const payload = await response.json()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(response.status).toBe(500)
    expect(payload).toEqual({
      error: 'APNS request failed',
      details: {
        message: 'network down',
      },
    })
  })
})
