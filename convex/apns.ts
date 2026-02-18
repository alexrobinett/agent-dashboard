import { httpActionGeneric } from 'convex/server'

type PushRequestBody = {
  deviceToken: string
  title: string
  body: string
  data?: Record<string, string>
}

const APNS_URL = 'https://api.sandbox.push.apple.com/3/device/'

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const sendApnsPush = httpActionGeneric(async (_ctx, request) => {
  let parsedBody: unknown

  try {
    parsedBody = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (!parsedBody || typeof parsedBody !== 'object') {
    return badRequest('Request body must be a JSON object')
  }

  const { deviceToken, title, body, data } = parsedBody as Partial<PushRequestBody>

  if (!deviceToken || typeof deviceToken !== 'string') {
    return badRequest('Missing required field: deviceToken')
  }

  if (!title || typeof title !== 'string') {
    return badRequest('Missing required field: title')
  }

  if (!body || typeof body !== 'string') {
    return badRequest('Missing required field: body')
  }

  if (data !== undefined) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return badRequest('Invalid optional field: data must be an object of string values')
    }

    const hasNonStringValue = Object.values(data).some((value) => typeof value !== 'string')
    if (hasNonStringValue) {
      return badRequest('Invalid optional field: data must be an object of string values')
    }
  }

  const jwt = process.env.APNS_JWT ?? 'placeholder-jwt'
  const topic = process.env.APNS_TOPIC ?? 'com.example.app'

  const apnsPayload: Record<string, unknown> = {
    aps: {
      alert: {
        title,
        body,
      },
      sound: 'default',
    },
  }

  if (data) {
    Object.assign(apnsPayload, data)
  }

  try {
    const response = await fetch(`${APNS_URL}${encodeURIComponent(deviceToken)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'apns-topic': topic,
        'apns-push-type': 'alert',
      },
      body: JSON.stringify(apnsPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({
          error: 'APNS request failed',
          details: {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const apnsId = response.headers.get('apns-id')
    return new Response(JSON.stringify({ success: true, apnsId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown APNS error'
    return new Response(
      JSON.stringify({
        error: 'APNS request failed',
        details: {
          message,
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
