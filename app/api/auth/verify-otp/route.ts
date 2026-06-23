import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Supabase admin client is not configured. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' 
      }, { status: 500 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // 1. Fetch OTP record
    const { data: record, error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .select('code, expires_at')
      .eq('email', cleanEmail)
      .single();

    if (dbError || !record) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }

    // 2. Check code matching & expiration
    if (record.code !== cleanCode) {
      return NextResponse.json({ error: 'Incorrect verification code. Please check your email' }, { status: 400 });
    }

    if (new Date(record.expires_at) < new Date()) {
      // Delete expired code
      await supabaseAdmin.from('otp_codes').delete().eq('email', cleanEmail);
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one' }, { status: 400 });
    }

    // 3. Delete OTP record so it cannot be reused
    await supabaseAdmin.from('otp_codes').delete().eq('email', cleanEmail);

    // 4. Generate deterministic secure password for Supabase Auth
    const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const password = crypto.createHmac('sha256', pepper).update(cleanEmail).digest('hex');

    // 5. Authenticate user
    let sessionData: any = null;
    let authError: any = null;

    // Try signing in
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (signInError) {
      // User likely does not exist yet (or has a different password, which won't happen for clean emails).
      // Create user using Supabase Admin Auth API
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true
      });

      if (createError) {
        console.error('Error creating user via admin API:', createError);
        return NextResponse.json({ error: createError.message || 'Failed to register account' }, { status: 500 });
      }

      // Retry sign-in now that user is created and confirmed
      const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (retryError) {
        console.error('Error signing in after creation:', retryError);
        return NextResponse.json({ error: retryError.message || 'Failed to authenticate after signup' }, { status: 500 });
      }

      sessionData = retryData.session;
    } else {
      sessionData = signInData.session;
    }

    if (!sessionData) {
      return NextResponse.json({ error: 'Failed to retrieve session tokens' }, { status: 500 });
    }

    // Return the access and refresh tokens to establish user session in the frontend client
    return NextResponse.json({
      success: true,
      session: {
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
        user: sessionData.user
      }
    });

  } catch (error: any) {
    console.error('Verify OTP route error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred during verification' }, { status: 500 });
  }
}
