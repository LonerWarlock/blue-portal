import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getModelConfig } from '@/lib/models';

export const runtime = 'edge';

const BLUE_CREDIT_MULTIPLIER = 1.5;

async function deductBalance(
  userId: string,
  cost: number,
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  accountType: string
) {
  try {
    if (!supabaseAdmin) return;

    const blueCreditsCost = accountType === 'pro_payg' ? cost * BLUE_CREDIT_MULTIPLIER : 0;

    if (accountType === 'pro_payg') {
      const { data: newBalance, error: rpcError } = await supabaseAdmin.rpc(
        'deduct_blue_credits',
        { user_id_param: userId, cost_param: blueCreditsCost }
      );

      if (rpcError) {
        console.warn('Blue Credits RPC failed, fallback:', rpcError);
        const { data: walletData } = await supabaseAdmin
          .from('wallets')
          .select('blue_credits')
          .eq('user_id', userId)
          .single();

        if (walletData) {
          const updated = Number(walletData.blue_credits) - blueCreditsCost;
          await supabaseAdmin
            .from('wallets')
            .update({ blue_credits: updated, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        }
      }

      await supabaseAdmin.rpc('increment_blue_credits_used', {
        user_id_param: userId,
        amount_param: blueCreditsCost
      });
    } else {
      const { data: newBalance, error: rpcError } = await supabaseAdmin.rpc(
        'deduct_wallet_balance',
        { user_id_param: userId, cost_param: cost }
      );

      if (rpcError) {
        console.warn('Atomic RPC deduction failed, fallback:', rpcError);
        const { data: walletData, error: readError } = await supabaseAdmin
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (readError || !walletData) throw new Error('Failed to read wallet');

        const updatedBalance = Number(walletData.balance) - cost;
        await supabaseAdmin
          .from('wallets')
          .update({ balance: updatedBalance })
          .eq('user_id', userId);
      }
    }

    const { error: txError } = await supabaseAdmin
      .from('billing_transactions')
      .insert({
        user_id: userId,
        model: modelId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost: accountType === 'pro_payg' ? 0 : cost,
        blue_credits_cost: accountType === 'pro_payg' ? blueCreditsCost : null,
        account_type: accountType,
        rate_card_version: accountType === 'pro_payg' ? `1.0x${BLUE_CREDIT_MULTIPLIER}` : null
      });

    if (txError) {
      console.error('Failed to insert billing audit log:', txError.message);
    }
  } catch (err: any) {
    console.error('Error during deduction:', err.message || err);
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const clientKey = authHeader.replace('Bearer ', '').trim();
    if (!clientKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'Supabase admin is not configured. Please contact the administrator.'
      }, { status: 500 });
    }

    const { data: keyRecord, error: dbError } = await supabaseAdmin
      .from('user_keys')
      .select('user_id')
      .eq('key', clientKey)
      .single();

    if (dbError || !keyRecord) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Blue API Key' }, { status: 401 });
    }

    let { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance, blue_credits, account_type')
      .eq('user_id', keyRecord.user_id)
      .single();

    if (walletError && walletError.code === 'PGRST116') {
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: keyRecord.user_id, balance: 1.00 })
        .select('balance, blue_credits, account_type')
        .single();

      if (createError) {
        console.error('Failed to create wallet:', createError);
        return NextResponse.json({ error: 'Database wallet initialization failed' }, { status: 500 });
      }
      walletData = newWallet;
    } else if (walletError) {
      console.error('Failed to fetch wallet:', walletError);
      return NextResponse.json({ error: 'Failed to retrieve balance information' }, { status: 500 });
    }

    const accountType = walletData?.account_type || 'standard';
    const isProPayg = accountType === 'pro_payg';
    const availableBalance = isProPayg ? Number(walletData?.blue_credits || 0) : Number(walletData?.balance || 0);

    if (availableBalance <= 0) {
      const msg = isProPayg
        ? 'Payment Required: Your Blue Credits have finished. Top up at /blue-pro/dashboard to continue.'
        : 'Payment Required: Your API key wallet has $0.00 or insufficient credits. Please top up your balance.';
      return NextResponse.json({ error: msg }, { status: 402 });
    }

    const body = await request.json();
    const { model, messages, temperature, tools, stream } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const modelConfig = getModelConfig(model || '');
    const upstreamModel = modelConfig.upstreamModel;
    const isFree = modelConfig.isFree;
    const inputPrice = parseFloat(modelConfig.inputPrice || '0');
    const outputPrice = parseFloat(modelConfig.outputPrice || '0');

    const openCodeKey = process.env.OPENCODE_ZEN_API_KEY;
    if (!openCodeKey || openCodeKey === 'your_opencode_api_key_here') {
      return NextResponse.json({
        error: 'Upstream provider key (OPENCODE_ZEN_API_KEY) is not configured on the gateway server.'
      }, { status: 500 });
    }

    const upstreamUrl = 'https://opencode.ai/zen/v1/chat/completions';

    const isStream = stream ?? true;
    const bodyPayload: any = {
      model: upstreamModel,
      messages,
      temperature: temperature ?? 0.5,
      stream: isStream,
    };

    if (isStream) {
      bodyPayload.stream_options = { include_usage: true };
    }

    if (tools) {
      bodyPayload.tools = tools;
      bodyPayload.tool_choice = 'auto';
    }

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openCodeKey}`
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenCode upstream error:', errorText);
      return NextResponse.json({
        error: `Upstream service error (Status ${response.status}): ${errorText}`
      }, { status: response.status });
    }

    if (!isStream) {
      const data = await response.json();

      let promptTokens = 0;
      let completionTokens = 0;

      if (data.usage) {
        promptTokens = data.usage.prompt_tokens || 0;
        completionTokens = data.usage.completion_tokens || 0;
      } else {
        const promptText = messages.map((m: any) => m.content).join(' ');
        promptTokens = Math.max(1, Math.round(promptText.length / 4));
        const completionText = data.choices?.[0]?.message?.content || '';
        completionTokens = Math.max(1, Math.round(completionText.length / 4));
      }

      const inputCost = (promptTokens / 1000000) * inputPrice;
      const outputCost = (completionTokens / 1000000) * outputPrice;
      const totalCost = isFree ? 0 : (inputCost + outputCost);

      if (!isFree && totalCost > 0) {
        await deductBalance(
          keyRecord.user_id, totalCost, modelConfig.id,
          promptTokens, completionTokens, accountType
        );
      }

      return NextResponse.json(data);
    }

    const responseStream = response.body;
    if (!responseStream) {
      return NextResponse.json({ error: 'Empty upstream response stream' }, { status: 500 });
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const promptText = messages.map((m: any) => m.content).join(' ');
    const estimatedPromptTokens = Math.max(1, Math.round(promptText.length / 4));

    let promptTokens = 0;
    let completionTokens = 0;
    let completionText = '';
    let usageFound = false;

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);

        try {
          const text = decoder.decode(chunk, { stream: true });
          buffer += text;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            if (cleanLine.startsWith('data: ')) {
              const dataStr = cleanLine.slice(6).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(dataStr);

                if (parsed.usage) {
                  promptTokens = parsed.usage.prompt_tokens || 0;
                  completionTokens = parsed.usage.completion_tokens || 0;
                  usageFound = true;
                } else if (parsed.choices?.[0]?.delta?.content) {
                  completionText += parsed.choices[0].delta.content;
                }
              } catch (e) {
              }
            }
          }
        } catch (err: any) {
          console.error('Error parsing stream:', err.message || err);
        }
      },
      async flush() {
        try {
          const finalPromptTokens = usageFound ? promptTokens : estimatedPromptTokens;
          const finalCompletionTokens = usageFound
            ? completionTokens
            : Math.max(1, Math.round(completionText.length / 4));

          const inputCost = (finalPromptTokens / 1000000) * inputPrice;
          const outputCost = (finalCompletionTokens / 1000000) * outputPrice;
          const totalCost = isFree ? 0 : (inputCost + outputCost);

          if (!isFree && totalCost > 0) {
            await deductBalance(
              keyRecord.user_id, totalCost, modelConfig.id,
              finalPromptTokens, finalCompletionTokens, accountType
            );
          }
        } catch (err: any) {
          console.error('Error processing stream charge:', err.message || err);
        }
      }
    });

    const pipedStream = responseStream.pipeThrough(transformStream);
    return new Response(pipedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });

  } catch (error: any) {
    console.error('Chat completions API gateway error:', error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}
