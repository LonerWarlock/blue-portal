import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getModelConfig } from '@/lib/models';

export const runtime = 'edge';

// Safe balance deduction function with atomic PostgreSQL RPC + JS fallback
async function deductBalance(
  userId: string,
  cost: number,
  modelId: string,
  promptTokens: number,
  completionTokens: number
) {
  try {
    if (!supabaseAdmin) return;

    // 1. Deduct wallet balance (Try atomic RPC first to prevent concurrency double-spend)
    const { data: newBalance, error: rpcError } = await supabaseAdmin.rpc(
      'deduct_wallet_balance',
      {
        user_id_param: userId,
        cost_param: cost
      }
    );

    if (rpcError) {
      console.warn('Atomic RPC deduction failed, falling back to read-and-write:', rpcError);
      
      // Fallback: Read balance
      const { data: walletData, error: readError } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (readError || !walletData) {
        throw new Error('Failed to read wallet balance for manual update');
      }

      const currentBalance = Number(walletData.balance);
      const updatedBalance = currentBalance - cost;

      // Fallback: Update balance
      const { error: writeError } = await supabaseAdmin
        .from('wallets')
        .update({ balance: updatedBalance })
        .eq('user_id', userId);

      if (writeError) {
        throw new Error(`Manual balance update failed: ${writeError.message}`);
      }
    }

    // 2. Log transaction audit record
    const { error: txError } = await supabaseAdmin
      .from('billing_transactions')
      .insert({
        user_id: userId,
        model: modelId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost: cost
      });

    if (txError) {
      console.error('Failed to insert billing audit log:', txError.message);
    }

  } catch (err: any) {
    console.error('Error during wallet balance deduction:', err.message || err);
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate client key
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

    // Verify key in Supabase database
    const { data: keyRecord, error: dbError } = await supabaseAdmin
      .from('user_keys')
      .select('user_id')
      .eq('key', clientKey)
      .single();

    if (dbError || !keyRecord) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Blue API Key' }, { status: 401 });
    }

    // 2. Pre-flight Balance check
    let { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', keyRecord.user_id)
      .single();

    // Auto-create wallet if it doesn't exist (fail-safe)
    if (walletError && walletError.code === 'PGRST116') {
      const { data: newWallet, error: createError } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: keyRecord.user_id, balance: 1.00 })
        .select('balance')
        .single();
        
      if (createError) {
        console.error('Failed to create wallet on completions request:', createError);
        return NextResponse.json({ error: 'Database wallet initialization failed' }, { status: 500 });
      }
      walletData = newWallet;
    } else if (walletError) {
      console.error('Failed to fetch wallet for completions check:', walletError);
      return NextResponse.json({ error: 'Failed to retrieve balance information' }, { status: 500 });
    }

    const balance = Number(walletData?.balance || 0);
    if (balance <= 0) {
      return NextResponse.json({ 
        error: 'Payment Required: Your API key wallet has $0.00 or insufficient credits. Please top up your balance in the Developer Portal.' 
      }, { status: 402 });
    }

    // 3. Parse request payload
    const body = await request.json();
    const { model, messages, temperature, tools, stream } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // 4. Resolve target model pricing config
    const modelConfig = getModelConfig(model || '');
    const upstreamModel = modelConfig.upstreamModel;
    const isFree = modelConfig.isFree;
    const inputPrice = parseFloat(modelConfig.inputPrice || '0');
    const outputPrice = parseFloat(modelConfig.outputPrice || '0');

    // 5. Retrieve OpenCode Master API Key
    const openCodeKey = process.env.OPENCODE_ZEN_API_KEY;
    if (!openCodeKey || openCodeKey === 'your_opencode_api_key_here') {
      return NextResponse.json({ 
        error: 'Upstream provider key (OPENCODE_ZEN_API_KEY) is not configured on the gateway server.' 
      }, { status: 500 });
    }

    // 6. Query OpenCode API
    const upstreamUrl = 'https://opencode.ai/zen/v1/chat/completions';
    
    // Inject stream_options so OpenCode returns dynamic usage details inside the stream
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

    // --- CASE A: NON-STREAMING RESPONSE ---
    if (!isStream) {
      const data = await response.json();
      
      // Calculate costs using OpenCode usage logs
      let promptTokens = 0;
      let completionTokens = 0;
      
      if (data.usage) {
        promptTokens = data.usage.prompt_tokens || 0;
        completionTokens = data.usage.completion_tokens || 0;
      } else {
        // Fallback estimation (1 token ~ 4 chars)
        const promptText = messages.map(m => m.content).join(' ');
        promptTokens = Math.max(1, Math.round(promptText.length / 4));
        const completionText = data.choices?.[0]?.message?.content || '';
        completionTokens = Math.max(1, Math.round(completionText.length / 4));
      }
      
      const inputCost = (promptTokens / 1000000) * inputPrice;
      const outputCost = (completionTokens / 1000000) * outputPrice;
      const totalCost = isFree ? 0 : (inputCost + outputCost);
      
      if (!isFree && totalCost > 0) {
        await deductBalance(
          keyRecord.user_id,
          totalCost,
          modelConfig.id,
          promptTokens,
          completionTokens
        );
      }
      
      return NextResponse.json(data);
    }

    // --- CASE B: STREAMING RESPONSE WITH INTERCEPTION ---
    const responseStream = response.body;
    if (!responseStream) {
      return NextResponse.json({ error: 'Empty upstream response stream' }, { status: 500 });
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    // Default estimates in case usage block is omitted
    const promptText = messages.map(m => m.content).join(' ');
    const estimatedPromptTokens = Math.max(1, Math.round(promptText.length / 4));
    
    let promptTokens = 0;
    let completionTokens = 0;
    let completionText = '';
    let usageFound = false;

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        // Enqueue immediately to bypass pipeline latency entirely
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
                
                // Extract usage statistics if returned by OpenCode in stream
                if (parsed.usage) {
                  promptTokens = parsed.usage.prompt_tokens || 0;
                  completionTokens = parsed.usage.completion_tokens || 0;
                  usageFound = true;
                } else if (parsed.choices?.[0]?.delta?.content) {
                  // Fallback content accumulation
                  completionText += parsed.choices[0].delta.content;
                }
              } catch (e) {
                // Ignore incomplete JSON chunks on boundaries
              }
            }
          }
        } catch (err: any) {
          console.error('Error parsing stream chunk for billing:', err.message || err);
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
              keyRecord.user_id,
              totalCost,
              modelConfig.id,
              finalPromptTokens,
              finalCompletionTokens
            );
          }
        } catch (err: any) {
          console.error('Error processing stream completion charge:', err.message || err);
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
