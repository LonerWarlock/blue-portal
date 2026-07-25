import { NextResponse } from 'next/server';
import { authenticateBlueKey, BLUE_CREDIT_MULTIPLIER, releaseUsage, reserveUsage, settleUsage, statusError } from '@/lib/bluePayg';
import { estimatePromptTokens, getOpenRouterModels, modelsForAccess, openRouterApiKey, price, publicModel, resolveModel } from '@/lib/openrouter';

export const runtime = 'edge';

const TOP_UP_URL = '/blue-pro/checkout';
const MAX_REQUEST_BYTES = 2_000_000;

interface UsageData {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
}

export async function POST(request: Request) {
  let account: Awaited<ReturnType<typeof authenticateBlueKey>> | undefined;
  let requestId = '';
  let reserved = false;

  try {
    const token = bearerToken(request);
    account = await authenticateBlueKey(token);
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) throw statusError(413, 'Request is too large');

    const body = JSON.parse(rawBody) as Record<string, unknown>;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw statusError(400, 'A non-empty messages array is required');
    }

    const availableModels = modelsForAccess(await getOpenRouterModels(), account.accessTier);
    const model = resolveModel(availableModels, String(body.model || ''));
    if (!model) {
      throw statusError(400, account.accessTier === 'trial'
        ? 'This model is not included in the Blue Pro Starter catalog'
        : 'The requested model is unavailable');
    }

    const modelInfo = publicModel(model);
    const promptTokens = estimatePromptTokens(body.messages, body.tools);
    const inputCost = promptTokens * price(model.pricing?.prompt);
    const requestedMaxTokens = boundedInteger(body.max_tokens ?? body.max_completion_tokens, 4096, 256, 16_384);
    const affordableProviderCost = Math.max(0, account.balance / BLUE_CREDIT_MULTIPLIER / 1.15 - inputCost - price(model.pricing?.request));
    const outputPrice = price(model.pricing?.completion);
    const affordableOutputTokens = outputPrice > 0
      ? Math.floor(affordableProviderCost / outputPrice)
      : requestedMaxTokens;
    const maxTokens = Math.min(requestedMaxTokens, affordableOutputTokens);

    if (account.balance <= 0 || maxTokens < 256) {
      return paymentRequired(account.balance, account.threshold);
    }

    const estimatedProviderCost = inputCost
      + maxTokens * outputPrice
      + price(model.pricing?.request);
    const reservationAmount = Math.max(0.0001, estimatedProviderCost * BLUE_CREDIT_MULTIPLIER * 1.15);
    requestId = crypto.randomUUID();
    await reserveUsage(account, requestId, model.id, reservationAmount);
    reserved = true;

    const upstreamPayload = {
      ...body,
      model: model.id,
      max_tokens: maxTokens,
      stream: body.stream !== false,
      stream_options: undefined
    };

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterApiKey()}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app',
        'X-Title': 'Blue AI'
      },
      body: JSON.stringify(upstreamPayload),
      signal: request.signal
    });

    if (!upstream.ok) {
      await releaseUsage(account, requestId);
      reserved = false;
      const providerMessage = await safeProviderMessage(upstream);
      return NextResponse.json({ error: providerMessage }, { status: upstream.status });
    }

    if (body.stream === false) {
      const payload = await upstream.json() as Record<string, unknown> & { usage?: UsageData };
      const usage = normalizedUsage(payload.usage, promptTokens, JSON.stringify(payload.choices || '').length, model);
      const settlement = await settleUsage(account, requestId, usage.cost, usage.promptTokens, usage.completionTokens);
      reserved = false;
      return NextResponse.json({
        ...payload,
        model: modelInfo.id,
        usage: publicUsage(usage, settlement)
      });
    }

    if (!upstream.body) throw statusError(502, 'OpenRouter returned an empty response stream');
    return streamingResponse(upstream.body, account, requestId, promptTokens, model, request.signal);
  } catch (error) {
    if (reserved && account && requestId) await releaseUsage(account, requestId);
    const status = errorStatus(error);
    if (status === 402) return paymentRequired(account?.balance || 0, account?.threshold || 0.15);
    const message = error instanceof SyntaxError ? 'Invalid JSON request body' : errorMessage(error);
    console.error('[Blue PAYG] Chat request failed:', message);
    return NextResponse.json({ error: message }, { status });
  }
}

function streamingResponse(
  upstream: ReadableStream<Uint8Array>,
  account: Awaited<ReturnType<typeof authenticateBlueKey>>,
  requestId: string,
  estimatedPromptTokens: number,
  model: Awaited<ReturnType<typeof getOpenRouterModels>>[number],
  signal: AbortSignal
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstream.getReader();
  let buffer = '';
  let completionCharacters = 0;
  let providerUsage: UsageData | undefined;
  let finalized: Promise<ReturnType<typeof publicUsage>> | undefined;

  const finalize = () => {
    if (finalized) return finalized;
    finalized = (async () => {
      const usage = normalizedUsage(providerUsage, estimatedPromptTokens, completionCharacters, model);
      const settlement = await settleUsage(account, requestId, usage.cost, usage.promptTokens, usage.completionTokens);
      return publicUsage(usage, settlement);
    })();
    return finalized;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abort = () => void reader.cancel('Client disconnected').finally(() => finalize().catch(error => {
        console.error('[Blue PAYG] Failed to settle cancelled stream:', errorMessage(error));
      }));
      signal.addEventListener('abort', abort, { once: true });

      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          buffer += decoder.decode(result.value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === 'data: [DONE]') continue;
            let forward = true;
            if (trimmed.startsWith('data: ')) {
              const payload = parseSseJson(trimmed.slice(6));
              if (payload?.usage) {
                providerUsage = payload.usage as UsageData;
                forward = false;
              }
              const content = payload?.choices?.[0]?.delta?.content;
              if (typeof content === 'string') completionCharacters += content.length;
            }
            if (forward) controller.enqueue(encoder.encode(`${line}\n`));
          }
        }

        const usage = await finalize();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'blue.usage', usage })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        try {
          await finalize();
        } catch (settlementError) {
          console.error('[Blue PAYG] Stream settlement failed:', errorMessage(settlementError));
        }
        if (!signal.aborted) controller.error(error);
      } finally {
        signal.removeEventListener('abort', abort);
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      await finalize();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}

function normalizedUsage(
  usage: UsageData | undefined,
  estimatedPromptTokens: number,
  completionCharacters: number,
  model: Awaited<ReturnType<typeof getOpenRouterModels>>[number]
) {
  const promptTokens = Math.max(0, Number(usage?.prompt_tokens || estimatedPromptTokens));
  const completionTokens = Math.max(0, Number(usage?.completion_tokens || Math.ceil(completionCharacters / 3)));
  const reportedCost = Number(usage?.cost);
  const cost = Number.isFinite(reportedCost) && reportedCost >= 0
    ? reportedCost
    : promptTokens * price(model.pricing?.prompt)
      + completionTokens * price(model.pricing?.completion)
      + price(model.pricing?.request);
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, cost };
}

function publicUsage(
  usage: ReturnType<typeof normalizedUsage>,
  settlement: Awaited<ReturnType<typeof settleUsage>>
) {
  return {
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    total_tokens: usage.totalTokens,
    cost: usage.cost,
    blue_credits_used: settlement.charged,
    blue_credits_remaining: settlement.remaining,
    blue_credit_threshold: settlement.threshold,
    blue_credit_warning: settlement.low,
    blue_request_id: settlement.requestId
  };
}

function bearerToken(request: Request): string {
  let authorization = '';
  try {
    authorization = request.headers.get('authorization')
      || request.headers.get('Authorization')
      || request.headers.get('x-api-key')
      || request.headers.get('X-Api-Key')
      || '';
  } catch {}

  if (!authorization && request.headers) {
    try {
      request.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (k === 'authorization' || k === 'x-api-key' || k === 'api-key') {
          if (!authorization) authorization = value;
        }
      });
    } catch {}
  }

  if (!authorization) throw statusError(401, 'Missing Authentication header');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : authorization.trim();
  if (!token) throw statusError(401, 'A Blue API key is required');
  return token;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Math.floor(Number(value || fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function parseSseJson(value: string): Record<string, any> | undefined {
  try {
    return JSON.parse(value) as Record<string, any>;
  } catch {
    return undefined;
  }
}

async function safeProviderMessage(response: Response): Promise<string> {
  const fallback = `OpenRouter request failed (${response.status})`;
  try {
    const payload = await response.json() as { error?: { message?: string } | string };
    if (typeof payload.error === 'string') return payload.error;
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

function paymentRequired(balance: number, threshold: number) {
  return NextResponse.json({
    error: 'Your Blue Credits are exhausted. Add credits to continue.',
    code: 'blue_credits_exhausted',
    blue_credits_remaining: Math.max(0, balance),
    blue_credit_threshold: threshold,
    renewal_url: TOP_UP_URL
  }, { status: 402 });
}

function errorStatus(error: unknown): number {
  const status = Number((error as { status?: number })?.status || 500);
  return status >= 400 && status <= 599 ? status : 500;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An internal server error occurred';
}
