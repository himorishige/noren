// Stream utilities for PII redaction with binary data support

import type { Registry } from './index.js'
import { redactText } from './index.js'
import type { Policy } from './types.js'
import { isBinaryChunk } from './utils.js'

/**
 * Create a TransformStream that processes text chunks for PII redaction
 * while preserving binary chunks unchanged
 */
export function createRedactionTransform(
  registry: Registry,
  options: {
    window?: number
    policy?: Policy
  } = {},
) {
  const { window = 96, policy = {} } = options
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let tail = ''
  let tailIsBinary = false

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      // Check if current chunk is binary data
      if (isBinaryChunk(chunk)) {
        // If we have text tail, process it first
        if (tail && !tailIsBinary) {
          const redacted = await redactText(registry, tail, policy)
          controller.enqueue(enc.encode(redacted))
          tail = ''
        }
        // Pass binary chunk through unchanged
        controller.enqueue(chunk)
        return
      }

      try {
        // Decode as text
        const text = dec.decode(chunk, { stream: true })
        const buf = tail + text
        const cut = Math.max(0, buf.length - window)
        const head = buf.slice(0, cut)

        if (head) {
          const redacted = await redactText(registry, head, policy)
          controller.enqueue(enc.encode(redacted))
        }

        tail = buf.slice(cut)
        tailIsBinary = false
      } catch (_error) {
        // If text decoding fails, treat as binary
        if (tail && !tailIsBinary) {
          const redacted = await redactText(registry, tail, policy)
          controller.enqueue(enc.encode(redacted))
          tail = ''
        }
        controller.enqueue(chunk)
      }
    },

    async flush(controller) {
      if (tail && !tailIsBinary) {
        const redacted = await redactText(registry, tail, policy)
        controller.enqueue(enc.encode(redacted))
      }
    },
  })
}
