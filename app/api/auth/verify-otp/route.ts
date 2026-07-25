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

    // 5. Try signing in first (works immediately if password is already in sync)
    let { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    // 6. If sign in fails, user either doesn't exist or has a different password in Supabase Auth
    if (signInError || !signInData?.session) {
      // Try creating user
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true
      });

      if (createError) {
        // If user already exists, list users to locate their ID and update password
        const isAlreadyRegistered = createError.message?.toLowerCase().includes('already') || 
                                    createError.message?.toLowerCase().includes('registered') ||
                                    createError.status === 422;
                                    
        if (isAlreadyRegistered) {
          // Fetch user via admin API with large page size to handle pagination
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);

          if (existingUser) {
            // Sync password & confirm email
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password,
              email_confirm: true
            });
            if (updateError) {
              console.error('Error updating user password via admin API:', updateError);
            }
          }
        } else {
          console.error('Error creating user via admin API:', createError);
          return NextResponse.json({ error: createError.message || 'Failed to register account' }, { status: 500 });
        }
      }

      // Retry sign in after creation / password sync
      const { data: retrySignIn, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (retryError || !retrySignIn?.session) {
        console.error('Error signing in after creation/password sync:', retryError);
        return NextResponse.json({ error: retryError?.message || 'Failed to establish session' }, { status: 500 });
      }

      signInData = retrySignIn;
    }

    // 7. Return session tokens to client
    return NextResponse.json({
      success: true,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        user: signInData.session.user
      }
    });

  } catch (error: any) {
    console.error('Verify OTP route error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred during verification' }, { status: 500 });
  }
}
