import { NextRequest, NextResponse } from 'next/server'
import { processWebhookPageEvent } from '@/lib/sync/webhook-handler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type NotionWebhookPayload = {
  verification_token?: string
  type?: string
  entity?: { id?: string; type?: string }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NotionWebhookPayload

    if (body.verification_token) {
      return NextResponse.json(
        { verification_token: body.verification_token },
        { status: 200 }
      )
    }

    const eventType = body.type
    const entity = body.entity

    if (!eventType || !entity?.id) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const relevantEvents = [
      'page.properties_updated',
      'page.deleted',
      'page.created',
      'page.undeleted',
    ]

    if (relevantEvents.includes(eventType) && entity.type === 'page') {
      try {
        await processWebhookPageEvent(entity.id, eventType)
      } catch (err) {
        console.error('[Webhook] Error processing event:', err)
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('[Webhook] Error:', err)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
