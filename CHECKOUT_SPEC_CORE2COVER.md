# Blue Portal ↔ core2cover.in — Checkout Integration Specification

> Feed this document to the AI agent building `core2cover.in`. It contains everything needed to implement the checkout page and complete the subscription flow end-to-end.

---

## 1. Overview & Architecture

**blue-portal** (Next.js 14, Supabase) runs on port `3005`. It has a `/subscribe` page offering a **Blue plan (₹149/month)**. When the user clicks "Subscribe Now", they are redirected to **core2cover** (`http://localhost:3000`) which hosts the payment/checkout page. Both apps share the **same Supabase database** using the **service role key**.

### Shared Supabase Project
- **URL:** `https://pmaoafsnmaqwjnikpvbg.supabase.co`
- **Service Role Key:** `sb_secret_6q3Ec7rP-06zQNcWV1Ahjg_oMySUaoA`
- **Anon Key:** `sb_publishable_voTZinQfPO0Kf20xwrHl1A_TrxCIHIO`

core2cover.in must initialize a Supabase admin client (service role) for DB writes. The service key bypasses RLS, so it can read/write `checkout_sessions` and `subscriptions` directly.

---

## 2. Complete End-to-End Flow

```
User clicks "Subscribe Now" on blue-portal.com/subscribe
    │
    ├── NOT logged in?
    │      └── Redirected to /console → logs in → lands back on /subscribe
    │          (user clicks Subscribe again, now authenticated)
    │
    └── Logged in?
           │
           ▼
    blue-portal calls POST /api/checkout/create-session (internally)
           │
           ▼
    Creates row in checkout_sessions table:
      { id: uuid, user_id: "...", plan: "blue", status: "pending", expires_at: "15 min" }
           │
           ▼
    302 Redirect to:
      http://localhost:3000/checkout/blue?session_id=<uuid>&return_url=http://localhost:3005/console
           │
           ▼
    core2cover.in receives the request
      └── Reads session_id from query param
      └── Queries checkout_sessions table to validate session
      └── Looks up user from auth.users via Supabase Admin API
      └── Displays checkout page with plan info + user email
      └── User enters payment details
      └── ⚠️ YOU IMPLEMENT PAYMENT PROCESSING HERE (Stripe/Razorpay/etc.)
           │
           ▼
    ON SUCCESS:
      UPDATE checkout_sessions SET status = 'completed', completed_at = now()
      INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end, stripe_subscription_id, stripe_customer_id)
      Redirect user → return_url (e.g. https://blue-portal.com/console)
    
    ON FAILURE/CANCEL:
      Show error on core2cover.in
      User can go back to blue-portal.com/subscribe and retry
```

---

## 3. Database Tables (Already Created — Run in Supabase SQL Editor)

### Table: `checkout_sessions`

```sql
create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  plan text not null default 'blue',
  billing_cycle text not null default 'monthly',
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb default '{}'
);
```

**`metadata` field shape:** When blue-portal creates a session, it stores:
```json
{ "email": "user@example.com" }
```

### Table: `subscriptions`

```sql
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null unique,
  plan text not null default 'blue',
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'expired')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb default '{}'
);
```

### RLS Policies
- **Admin (service role):** full access to both tables (used by core2cover.in)
- **Users:** SELECT only on their own rows (used by blue-portal for display)

---

## 4. The Incoming Request — What core2cover.in Receives

### URL Pattern (GET)
```
http://localhost:3000/checkout/blue?session_id=<UUID>&return_url=<URL_ENCODED>
```

### Query Parameters

| Parameter    | Type   | Required | Example                                               | Description                                |
|-------------|--------|----------|-------------------------------------------------------|--------------------------------------------|
| `session_id` | UUID   | ✅ Yes   | `a1b2c3d4-e5f6-7890-abcd-ef1234567890`                | Primary identifier for the checkout session |
| `return_url` | String | ✅ Yes   | `http%3A%2F%2Flocalhost%3A3005%2Fconsole`             | Where to redirect the user after payment   |

### What core2cover.in should do on page load:

**Step 1 — Validate the session_id exists in the `checkout_sessions` table:**
```javascript
const { data: session, error } = await supabaseAdmin
  .from('checkout_sessions')
  .select('*')
  .eq('id', sessionId)
  .single();
```

**Step 2 — Validate the session is usable:**
```javascript
if (!session || session.status !== 'pending' || new Date(session.expires_at) < new Date()) {
  // Show error: "This checkout link has expired or is invalid. Please go back and try again."
  // Provide a link back to https://blue-portal.com/subscribe
}
```

**Step 3 — Fetch the user's details from Supabase Auth:**
```javascript
const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(session.user_id);
// or if using the service role client:
// await supabaseAdmin.auth.getUser() won't work here since no token is sent
// Use: supabaseAdmin.auth.admin.getUserById(uuid)
```

**Step 4 — Display checkout page** with:
- User's email (from metadata or user object)
- Plan name: "Blue" (₹149/month)
- Billing cycle: monthly
- Price display: ₹149

---

## 5. What core2cover.in Must Implement

### 5.1 Route: `/checkout/blue` (GET)
- Parse `session_id` and `return_url` from query params
- Validate session (exists, status=pending, not expired)
- Fetch user info from Supabase
- Render payment UI:
  - Show user email (readonly, for confirmation)
  - Show plan details (Blue, ₹149/month)
  - Payment method form (card/UPI/etc — your choice)
  - Pay button
  - Cancel link (goes back to blue-portal)

### 5.2 Payment Processing Logic
- Integrate your payment gateway (Stripe, Razorpay, etc.)
- On success: update DB tables + redirect
- On failure: show error on page

### 5.3 On Successful Payment — Database Writes

**Must execute in this order (ideally in a transaction):**

```javascript
// 1. Mark checkout session as completed
const { error: sessionError } = await supabaseAdmin
  .from('checkout_sessions')
  .update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  })
  .eq('id', sessionId);

// 2. Upsert subscription (one subscription per user — use upsert since user_id is unique)
const { error: subError } = await supabaseAdmin
  .from('subscriptions')
  .upsert({
    user_id: userId,
    plan: 'blue',
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: oneMonthLater(),  // calculate 1 month from now
    stripe_subscription_id: '...',        // from payment gateway
    stripe_customer_id: '...',            // from payment gateway
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
```

### 5.4 After Successful Payment — Redirect
```javascript
// Decode the return_url and redirect
const returnUrl = decodeURIComponent(returnUrlParam);
window.location.href = returnUrl;
// Optionally append ?subscription=success as a query param
// so blue-portal can show a success toast/banner
```

### 5.5 Error Handling
- If session is expired: show message like _"This checkout session has expired. Please return to Blue Portal and try subscribing again."_ with a link to `https://blue-portal.com/subscribe`
- If session is already completed: show _"This subscription has already been processed."_ with a link to `https://blue-portal.com/console`
- If payment fails: show error on page, allow retry. **Do not** mark the session as completed.
- If the user cancels: show a cancellation message, link back to `https://blue-portal.com/subscribe`

---

## 6. Database Connection Setup for core2cover.in

You have been given the same `.env` file with Supabase credentials. Here's how to connect. There are **two approaches** — pick the one that fits your stack.

---

### 6A. Approach 1 — Supabase JavaScript SDK (Recommended, matches blue-portal)

This is what blue-portal uses. It talks to the database over **HTTP/REST** — no direct Postgres port needed.

**Step 1 — Install the package:**
```bash
npm install @supabase/supabase-js
```

**Step 2 — Create the admin client (`lib/supabaseAdmin.ts`):**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
```

**Step 3 — `.env` variables (already in your file):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://pmaoafsnmaqwjnikpvbg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_6q3Ec7rP-06zQNcWV1Ahjg_oMySUaoA
```

**Step 4 — Example usage (validating a session):**
```typescript
const { data: session, error } = await supabaseAdmin
  .from('checkout_sessions')
  .select('*')
  .eq('id', sessionId)
  .single();

if (error || !session) {
  // session not found
}
```

---

### 6B. Approach 2 — Direct Postgres Connection (Prisma / pg / Drizzle)

If you prefer using a direct database driver or ORM (e.g. Prisma, Drizzle, `pg`), you need the **Postgres connection string** from Supabase.

**How to get the connection string:**
1. Go to your [Supabase Dashboard](https://supabase.com) → project `pmaoafsnmaqwjnikpvbg`
2. Click **Settings** (gear icon) → **Database**
3. Under **Connection string**, find the **URI** field — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.pmaoafsnmaqwjnikpvbg.supabase.co:5432/postgres
   ```
4. Copy it and set as `DATABASE_URL` in your `.env`

**⚠️ Important:** The password in the connection string is your **database password** — it is **NOT** the service role key. If you don't know the database password:
- Go to Supabase Dashboard → Settings → Database → **Reset database password**
- This will generate a new password — update both the Supabase Dashboard AND your `.env`

**Add to `.env`:**
```env
DATABASE_URL=postgresql://postgres:[YOUR-DB-PASSWORD]@db.pmaoafsnmaqwjnikpvbg.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://pmaoafsnmaqwjnikpvbg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_6q3Ec7rP-06zQNcWV1Ahjg_oMySUaoA
```

**Example with Prisma (`schema.prisma`):**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model checkout_sessions {
  id            String   @id @default(uuid()) @db.Uuid
  user_id       String   @db.Uuid
  plan          String   @default("blue")
  billing_cycle String   @default("monthly")
  status        String   @default("pending")
  expires_at    DateTime
  created_at    DateTime @default(now())
  completed_at  DateTime?
  metadata      Json?    @default("{}")

  @@map("checkout_sessions")
}

model subscriptions {
  id                   String   @id @default(uuid()) @db.Uuid
  user_id              String   @unique @db.Uuid
  plan                 String   @default("blue")
  status               String   @default("active")
  current_period_start DateTime @default(now())
  current_period_end   DateTime?
  stripe_subscription_id String?
  stripe_customer_id   String?
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt
  metadata             Json?    @default("{}")

  @@map("subscriptions")
}
```

Then run:
```bash
npx prisma db pull    # pulls schema from existing DB
# OR
npx prisma generate   # generates client if schema is written manually
```

---

### 6C. I Need Both — How They Relate

| What you need it for | Which credential | Which method |
|---------------------|-----------------|--------------|
| Query `checkout_sessions` table | Service role key | Supabase SDK (recommended) or Prisma |
| Query `subscriptions` table | Service role key | Supabase SDK (recommended) or Prisma |
| Look up user by ID (auth.users) | Service role key | Supabase SDK only: `supabaseAdmin.auth.admin.getUserById()` |
| Create/update records | Service role key | Supabase SDK or Prisma |

**Recommendation:** Use the Supabase JS SDK (Approach 6A) — it's simpler, handles auth user lookups natively, and matches blue-portal's pattern. Only use Prisma if you have an existing ORM setup you want to keep.

---

## 7. Edge Cases & Security Notes

| Scenario | What should happen |
|----------|-------------------|
| **Session expired** | Show expiration error, link back to blue-portal.com/subscribe |
| **Session already completed** | Show "already processed" message, link to blue-portal.com/console |
| **Session not found** | Show invalid link error |
| **User opens checkout directly without session_id** | Show error: "Missing checkout session" |
| **Payment succeeds but DB write fails** | ⚠️ Critical! Log the error. The payment went through but the user won't have a subscription. You need a reconciliation mechanism (Stripe webhook + periodic job) |
| **return_url is missing** | Default to `https://blue-portal.com/console` |
| **User refreshes the checkout page** | Re-validate session on every load. If still valid, continue. If expired/completed, show appropriate message |
| **User visits checkout URL after payment** | Show "already completed" state so they don't pay twice |
| **Multiple tabs** | Each session_id is single-use. One tab paying marks it completed; the other tab will show "already processed" |

---

## 8. Quick Implementation Checklist for core2cover.in

- [ ] Set up Supabase admin client with service role key
- [ ] Create route `/checkout/blue` (Next.js page or equivalent)
- [ ] Parse `session_id` + `return_url` from URL query params
- [ ] Validate session against `checkout_sessions` table
- [ ] Fetch user info via `supabaseAdmin.auth.admin.getUserById()`
- [ ] Build checkout UI showing plan + price + user email
- [ ] Integrate payment gateway (Stripe/Razorpay/etc.)
- [ ] On success: update `checkout_sessions` (status=completed) + upsert `subscriptions`
- [ ] On success: redirect to `return_url`
- [ ] Handle errors: expired session, payment failure, DB failure
- [ ] Handle edge cases: no session_id, already completed session, refresh

---

## 9. What blue-portal has already done

- [x] Created `checkout_sessions` + `subscriptions` tables (SQL in Supabase)
- [x] Built `POST /api/checkout/create-session` API route (creates session, returns session_id)
- [x] Updated `/subscribe` page to call the API and redirect to core2cover.in
- [x] Added `NEXT_PUBLIC_CHECKOUT_URL=https://core2cover.in` env var
- [x] Updated unauthenticated user flow (redirect → login → redirect back to subscribe)
- [x] Build passes with zero errors

---

## 10. Blue Portal Code Reference

### The redirect code in `app/subscribe/page.tsx` that sends users to you:

```typescript
const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || "http://localhost:3000";
const returnUrl = `${window.location.origin}/console`;
window.location.href = `${checkoutUrl}/checkout/blue?session_id=${data.session_id}&return_url=${encodeURIComponent(returnUrl)}`;
```

### The session creation code in `app/api/checkout/create-session/route.ts`:

```typescript
const { data: session, error: insertError } = await supabaseAdmin
  .from('checkout_sessions')
  .insert({
    user_id: user.id,
    plan: 'blue',
    billing_cycle: 'monthly',
    status: 'pending',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    metadata: { email: user.email },
  })
  .select('id')
  .single();
// Returns: { session_id: "uuid-here" }
```
