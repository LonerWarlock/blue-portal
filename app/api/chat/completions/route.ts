import { NextResponse } from 'next/server';
import { authenticateBlueKey, BLUE_CREDIT_MULTIPLIER, releaseUsage, reserveUsage, settleUsage, statusError } from '@/lib/bluePayg';
import { isBlueGatewayCancellationRequested, registerBlueGatewayRequest, unregisterBlueGatewayRequest } from '@/lib/blueRequestCancellation';
import { estimatePromptTokens, getOpenRouterModels, modelsForAccess, openRouterApiKey, price, publicModel, resolveModel } from '@/lib/openrouter';
import { normalizedUsage, UsageData, UsagePricing } from '@/lib/usageAccounting';

// Standard Node.js Serverless Runtime for full header & streaming compatibility
export const runtime = 'nodejs';

const TOP_UP_URL = '/blue-pro/checkout';
const MAX_REQUEST_BYTES = 2_000_000;

export async function POST(request: Request) {
  const traceId = request.headers.get('x-blue-trace-id') || crypto.randomUUID();
  let account: Awaited<ReturnType<typeof authenticateBlueKey>> | undefined;
  let requestId = '';
  let attemptId = '';
  let reserved = false;
  let activeRequestRegistered = false;
  let streamingResponseOwnsRequest = false;
  const upstreamAbortController = new AbortController();
  const abortUpstreamOnDisconnect = () => upstreamAbortController.abort('Blue client disconnected');
  request.signal.addEventListener('abort', abortUpstreamOnDisconnect, { once: true });

  try {
    const authorization = request.headers.get('authorization') || '';
    const xApiKey = request.headers.get('x-api-key') || '';
    const headerToken = extractTokenFromHeaders(request);
    let token = headerToken;
    console.log(
      `[Chat API Trace][${traceId}] request.received ` +
      `authorizationPresent=${Boolean(authorization)} authorizationLen=${authorization.length} ` +
      `xApiKeyPresent=${Boolean(xApiKey)} xApiKeyLen=${xApiKey.length} ` +
      `contentType=${request.headers.get('content-type') || 'missing'}`
    );
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) throw statusError(413, 'Request is too large');

    const body = JSON.parse(rawBody) as Record<string, unknown>;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw statusError(400, 'A non-empty messages array is required');
    }

    if (!token) {
      token = extractTokenFromBodyOrUrl(request, body);
    }
    const bodyKey = String(body.apiKey || body.api_key || body.key || '').trim();
    console.log(
      `[Chat API Trace][${traceId}] request.parsed ` +
      `tokenSource=${headerToken ? 'header' : bodyKey ? 'body' : 'url-or-none'} ` +
      `tokenPresent=${Boolean(token)} tokenLen=${token.length} ` +
      `bodyKeyPresent=${Boolean(bodyKey)} bodyKeyLen=${bodyKey.length} model=${String(body.model || 'missing')} ` +
      `messageCount=${Array.isArray(body.messages) ? body.messages.length : 0}`
    );
    account = await authenticateBlueKey(token);

    const availableModels = modelsForAccess(await getOpenRouterModels(), account.accessTier);
    const model = resolveModel(availableModels, String(body.model || ''));
    if (!model) {
      throw statusError(400, account.accessTier === 'trial'
        ? 'This model is not included in the Blue Pro Starter catalog'
        : 'The requested model is unavailable');
    }

    const modelInfo = publicModel(model);
    const usagePricing = pricingForModel(model);
    const promptTokens = estimatePromptTokens(body.messages, body.tools);
    const inputCost = promptTokens * usagePricing.prompt;
    const requestedMaxTokens = boundedInteger(body.max_tokens ?? body.max_completion_tokens, 4096, 256, 16_384);
    const affordableProviderCost = Math.max(0, account.balance / BLUE_CREDIT_MULTIPLIER / 1.15 - inputCost - usagePricing.request);
    const outputPrice = usagePricing.completion;
    const affordableOutputTokens = outputPrice > 0
      ? Math.floor(affordableProviderCost / outputPrice)
      : requestedMaxTokens;
    const maxTokens = Math.min(requestedMaxTokens, affordableOutputTokens);

    const estimatedProviderCost = inputCost
      + maxTokens * outputPrice
      + usagePricing.request;
    if ((estimatedProviderCost > 0 && account.balance <= 0) || maxTokens < 256) {
      return paymentRequired(account.balance, account.threshold, traceId);
    }

    const reservationAmount = estimatedProviderCost === 0
      ? 0
      : estimatedProviderCost * BLUE_CREDIT_MULTIPLIER * 1.15;
    requestId = validRequestId(request.headers.get('x-blue-request-id')) || crypto.randomUUID();
    attemptId = crypto.randomUUID();
    const reservation = await reserveUsage(account, requestId, model.id, reservationAmount);
    if (!reservation.accepted) {
      throw statusError(
        409,
        reservation.status === 'settled'
          ? 'This Blue request was already completed and will not be sent upstream twice.'
          : 'This Blue request is already in progress and will not be sent upstream twice.'
      );
    }
    reserved = true;
    registerBlueGatewayRequest(requestId, account, upstreamAbortController);
    activeRequestRegistered = true;

    if (await isBlueGatewayCancellationRequested(account, requestId)) {
      await releaseUsage(account, requestId);
      reserved = false;
      return NextResponse.json(
        { error: 'This Blue request was cancelled before it reached the provider.', request_id: requestId },
        { status: 499, headers: responseHeaders(traceId, requestId, attemptId) }
      );
    }

    const upstreamPayload = {
      ...body,
      model: model.id,
      max_tokens: maxTokens,
      stream: body.stream !== false,
      stream_options: { include_usage: true }
    };

    const providerKey = openRouterApiKey();
    if (!providerKey) throw statusError(500, 'OpenRouter is not configured for the Blue gateway');
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://blue-by-imergene.vercel.app',
        'X-Title': 'Blue AI',
        'X-Blue-Request-ID': requestId,
        'X-Blue-Attempt-ID': attemptId
      },
      body: JSON.stringify(upstreamPayload),
      signal: upstreamAbortController.signal
    });

    if (!upstream.ok) {
      await releaseUsage(account, requestId);
      reserved = false;
      const providerMessage = await safeProviderMessage(upstream);
      return NextResponse.json(
        { error: providerMessage, request_id: requestId, attempt_id: attemptId },
        { status: upstream.status, headers: responseHeaders(traceId, requestId, attemptId) }
      );
    }

    if (body.stream === false) {
      const payload = await upstream.json() as Record<string, unknown> & { usage?: UsageData };
      const usage = normalizedUsage(payload.usage, promptTokens, JSON.stringify(payload.choices || '').length, usagePricing);
      const settlement = await settleUsage(account, requestId, usage.cost, usage.promptTokens, usage.completionTokens);
      reserved = false;
      return NextResponse.json({
        ...payload,
        model: modelInfo.id,
        usage: publicUsage(usage, settlement, requestId, attemptId)
      }, {
        headers: responseHeaders(traceId, requestId, attemptId)
      });
    }

    if (!upstream.body) throw statusError(502, 'OpenRouter returned an empty response stream');
    streamingResponseOwnsRequest = true;
    return streamingResponse(
      upstream.body,
      account,
      requestId,
      attemptId,
      promptTokens,
      usagePricing,
      upstreamAbortController.signal,
      traceId,
      () => {
        unregisterBlueGatewayRequest(requestId);
        request.signal.removeEventListener('abort', abortUpstreamOnDisconnect);
      },
      () => upstreamAbortController.abort('Blue task cancelled by the user')
    );
  } catch (error) {
    if (reserved && account && requestId) await releaseUsage(account, requestId);
    const status = errorStatus(error);
    if (status === 402) {
      return paymentRequired(account?.balance || 0, account?.threshold || 0.15, traceId, requestId, attemptId);
    }
    const message = error instanceof SyntaxError ? 'Invalid JSON request body' : errorMessage(error);
    console.error(`[Chat API Trace][${traceId}] request.failed status=${status} message=${message}`);
    return NextResponse.json(
      { error: message, trace_id: traceId },
      { status, headers: responseHeaders(traceId, requestId, attemptId) }
    );
  } finally {
    if (activeRequestRegistered && !streamingResponseOwnsRequest) {
      unregisterBlueGatewayRequest(requestId);
    }
    if (!streamingResponseOwnsRequest) {
      request.signal.removeEventListener('abort', abortUpstreamOnDisconnect);
    }
  }
}

function streamingResponse(
  upstream: ReadableStream<Uint8Array>,
  account: Awaited<ReturnType<typeof authenticateBlueKey>>,
  requestId: string,
  attemptId: string,
  estimatedPromptTokens: number,
  pricing: UsagePricing,
  signal: AbortSignal,
  traceId: string,
  onClosed: () => void,
  cancelUpstream: () => void
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstream.getReader();
  let buffer = '';
  let completionCharacters = 0;
  let providerUsage: UsageData | undefined;
  let finalized: Promise<ReturnType<typeof publicUsage>> | undefined;
  let cancellationCheck: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (cancellationCheck) clearInterval(cancellationCheck);
    signal.removeEventListener('abort', abort);
    onClosed();
  };
  const abort = () => void reader.cancel('Blue client disconnected').finally(() => finalize().catch(error => {
    console.error('[Blue PAYG] Failed to settle cancelled stream:', errorMessage(error));
  }));
  const checkCancellation = () => {
    void isBlueGatewayCancellationRequested(account, requestId).then(cancelled => {
      if (!cancelled || closed) return;
      cancelUpstream();
      void reader.cancel('Blue task cancelled by the user');
    });
  };

  const finalize = () => {
    if (finalized) return finalized;
    finalized = (async () => {
      const usage = normalizedUsage(providerUsage, estimatedPromptTokens, completionCharacters, pricing);
      const settlement = await settleUsage(account, requestId, usage.cost, usage.promptTokens, usage.completionTokens);
      return publicUsage(usage, settlement, requestId, attemptId);
    })();
    return finalized;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      signal.addEventListener('abort', abort, { once: true });
      cancellationCheck = setInterval(checkCancellation, 1000);
      checkCancellation();

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
        reader.releaseLock();
        cleanup();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      await finalize();
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Blue-Trace-ID': traceId,
      'X-Blue-Request-ID': requestId,
      'X-Blue-Attempt-ID': attemptId
    }
  });
}

function publicUsage(
  usage: ReturnType<typeof normalizedUsage>,
  settlement: Awaited<ReturnType<typeof settleUsage>>,
  requestId: string,
  attemptId: string
) {
  return {
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    reasoning_tokens: usage.reasoningTokens,
    cache_read_tokens: usage.cacheReadTokens,
    cache_write_tokens: usage.cacheWriteTokens,
    cache_output_tokens: usage.cacheOutputTokens,
    total_tokens: usage.totalTokens,
    cost: usage.cost,
    cost_source: usage.costSource,
    provider_reported: usage.providerReported,
    route: 'openrouter',
    request_id: requestId,
    attempt_id: attemptId,
    blue_credits_used: settlement.charged,
    blue_credits_remaining: settlement.remaining,
    blue_credit_threshold: settlement.threshold,
    blue_credit_warning: settlement.low,
    blue_request_id: settlement.requestId
  };
}

function pricingForModel(model: Awaited<ReturnType<typeof getOpenRouterModels>>[number]): UsagePricing {
  const pricing = {
    prompt: price(model.pricing?.prompt),
    completion: price(model.pricing?.completion),
    request: price(model.pricing?.request),
    cacheRead: price(model.pricing?.input_cache_read),
    cacheWrite: price(model.pricing?.input_cache_write),
    cacheOutput: price(model.pricing?.output_cache_read),
    reasoning: price(model.pricing?.internal_reasoning)
  };
  return {
    ...pricing,
    free: Object.values(pricing).every(value => value === 0)
  };
}

function validRequestId(value: string | null): string {
  const clean = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(clean) ? clean : '';
}

function responseHeaders(traceId: string, requestId?: string, attemptId?: string): Record<string, string> {
  return {
    'X-Blue-Trace-ID': traceId,
    ...(requestId ? { 'X-Blue-Request-ID': requestId } : {}),
    ...(attemptId ? { 'X-Blue-Attempt-ID': attemptId } : {})
  };
}

function extractTokenFromHeaders(request: Request): string {
  let token = '';

  try {
    token = request.headers.get('authorization')
      || request.headers.get('Authorization')
      || request.headers.get('x-api-key')
      || request.headers.get('X-Api-Key')
      || '';
  } catch {}

  if (token.includes(',')) {
    token = token.split(',')[0].trim();
  }

  if (token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }
  return token;
}

function extractTokenFromBodyOrUrl(request: Request, body?: Record<string, unknown>): string {
  let token = '';

  try {
    const url = new URL(request.url);
    token = url.searchParams.get('key')
      || url.searchParams.get('apiKey')
      || url.searchParams.get('token')
      || '';
  } catch {}

  if (!token && body) {
    token = String(body.apiKey || body.api_key || body.key || '').trim();
  }

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

function paymentRequired(
  balance: number,
  threshold: number,
  traceId = 'untracked',
  requestId = '',
  attemptId = ''
) {
  return NextResponse.json({
    error: 'Your Blue Credits are exhausted. Add credits to continue.',
    code: 'blue_credits_exhausted',
    blue_credits_remaining: Math.max(0, balance),
    blue_credit_threshold: threshold,
    renewal_url: TOP_UP_URL,
    trace_id: traceId
  }, { status: 402, headers: responseHeaders(traceId, requestId, attemptId) });
}

function errorStatus(error: unknown): number {
  const status = Number((error as { status?: number })?.status || 500);
  return status >= 400 && status <= 599 ? status : 500;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An internal server error occurred';
}
