import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const databaseUrl = process.env.DATABASE_URL!;

  console.log("Supabase URL:", supabaseUrl);
  console.log("Database URL present:", !!databaseUrl);

  // 1. Supabase Auth Users
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  const { data: supabaseUsersData, error: sbError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (sbError) {
    console.error("Supabase error:", sbError);
  }

  const supabaseEmails = (supabaseUsersData?.users || [])
    .map(u => u.email?.trim().toLowerCase())
    .filter((e): e is string => !!e);

  console.log(`Fetched ${supabaseEmails.length} users from Supabase Auth.`);

  // 2. Neon DB Users
  let neonEmails: string[] = [];
  try {
    const sql = neon(databaseUrl);
    const rows = await sql`SELECT email FROM users WHERE email IS NOT NULL`;
    neonEmails = rows
      .map((r: any) => r.email?.trim().toLowerCase())
      .filter((e: string) => !!e);
    console.log(`Fetched ${neonEmails.length} users from Neon DB.`);
  } catch (err) {
    console.error("Neon DB error:", err);
  }

  // 3. Combine & Deduplicate
  const allEmailsSet = new Set<string>([...supabaseEmails, ...neonEmails]);
  const sortedEmails = Array.from(allEmailsSet).sort();

  console.log(`\n========================================`);
  console.log(`TOTAL UNIQUE DEDUPLICATED RECIPIENTS: ${sortedEmails.length}`);
  console.log(`========================================`);
  console.log("First 10 sample emails:", sortedEmails.slice(0, 10));
}

main().catch(console.error);
