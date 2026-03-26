# Complete Supabase Setup & Client Guide

A comprehensive guide explaining Supabase setup, environment configuration, client types, and proper usage patterns. After reading this, you'll understand exactly when and where to use each Supabase client.

---

## Table of Contents

1. [What is Supabase?](#what-is-supabase)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [The Three Supabase Clients](#the-three-supabase-clients)
5. [Client Comparison Matrix](#client-comparison-matrix)
6. [Detailed Client Breakdown](#detailed-client-breakdown)
7. [Authentication Architecture](#authentication-architecture)
8. [The Golden Flow](#the-golden-flow)
9. [Common Patterns](#common-patterns)
10. [Common Mistakes](#common-mistakes-and-fixes)

---

## What is Supabase?

Supabase is an open-source Firebase alternative that provides:
- **PostgreSQL Database** - Your data store
- **Authentication** - User sign-up, login, password reset
- **Row-Level Security (RLS)** - Database-level access control
- **Real-time subscriptions** - Live data updates
- **Storage** - File uploads (images, documents)
- **Edge Functions** - Serverless functions

Think of it as: **PostgreSQL + Auth + API + Storage + Real-time = Supabase**

---

## Prerequisites

Before using Supabase, you need:

1. **Project Credentials**
   - Supabase URL (your database endpoint)
   - Anon Key (public api key for browser requests)
   - Service Role Key (secret key for server-only operations)

2. **Installed Dependencies**
   ```bash
   npm install @supabase/supabase-js @supabase/ssr zod zustand
   ```
   - `@supabase/supabase-js` - Main Supabase SDK
   - `@supabase/ssr` - Server-side rendering support
   - `zod` - Type validation
   - `zustand` - State management

---

## Environment Setup

### Step 1: Create `.env.local` file

In your project root directory (same level as `package.json`), create a `.env.local` file:

```bash
# File: .env.local

# Supabase Connection Details
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5eHl6eHl6eHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE1NTU1NTU1NTUsImV4cCI6OTk5OTk5OTk5OX0...
```

### Step 2: Get Your Credentials

1. Log in to Supabase Dashboard
2. Go to **Settings** → **API**
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Public Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 3: Understand Key Naming

```
NEXT_PUBLIC_*  = Variables visible in browser (prefixed with NEXT_PUBLIC_)
(no prefix)    = Server-only secrets (hidden from browser)
```

**CRITICAL**: The keys are NOT secrets! They're public and used by your browser. The actual security comes from **Row-Level Security (RLS) policies** in your database.

### Example `.env.local` with all variables

```bash
# Frontend & Browser-Accessible (NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SUPABASE_URL=https://xyxyxyxyxyx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend-Only Secrets (NO prefix, never exposed to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Why two keys?

| Key | Visibility | Use Case | Permissions |
|-----|------------|----------|-------------|
| Anon Key (`NEXT_PUBLIC_*`) | Browser & Server | Regular users | Limited by RLS policies |
| Service Role Key | Server-Only | Admin operations | Bypass RLS (dangerous!) |

---

## The Three Supabase Clients

You have **THREE different Supabase clients**, each designed for different scenarios:

```
┌─────────────────────────────────────────────────────┐
│              YOUR APPLICATION                        │
├─────────────────────────────────────────────────────┤
│  Components      │ Middleware      │ Server Actions │
│  (Browser)       │ (Edge)          │ (Server)       │
├──────────────────┼──────────────────┼────────────────┤
│  client.ts       │ middleware.ts    │ server.ts      │
│  (Browser)       │ (Server)         │ (Server)       │
└─────────────────────────────────────────────────────┘
```

### Quick Reference

| Client | File | Location | Auth Method | Use Case |
|--------|------|----------|-------------|----------|
| **Browser Client** | `client.ts` | Components | Cookie-based | UI operations, read data |
| **Middleware Client** | `middleware.ts` | Next.js Middleware | Cookie-based | Auth refresh, protected routes |
| **Server Client** | `server.ts` | Server Actions | Cookie-based | Mutations, server-side queries |

---

## Client Comparison Matrix

### When to Use Each Client

```
┌──────────────────────────────────────────────────────────────────┐
│ DECISION TREE: Which Client Should I Use?                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ 1. Am I running in a React Component?                             │
│    └─→ YES: Use client.ts (Browser Client)                        │
│    └─→ NO:  Go to question 2                                      │
│                                                                    │
│ 2. Is this the Next.js middleware?                                │
│    └─→ YES: Use middleware.ts (Middleware Client)                 │
│    └─→ NO:  Use server.ts (Server Action Client)                  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Detailed Comparison Table

| Aspect | Browser Client | Middleware | Server Client |
|--------|---|---|---|
| **File** | `supabase/client.ts` | `supabase/middleware.ts` | `supabase/server.ts` |
| **Runs In** | Browser (client-side) | Edge runtime (between browser & server) | Server (Node.js) |
| **Auth Storage** | Cookies (automatic) | Cookies (read/write) | Cookies (server-side) |
| **Can read cookies?** | Yes (from browser) | Yes (from request headers) | Yes (server-side) |
| **Can set cookies?** | Yes (via JS API) | Yes (via response headers) | Yes (via setAll) |
| **Use for** | UI state, reads, non-auth mutations | Route protection, auth sync | Auth mutations, database writes |
| **Scope** | Current user only | Current user only | Service role (with setup) |
| **Performance** | Fast (client-side) | Very fast (edge cache) | Medium (server latency) |

---

## Detailed Client Breakdown

### 1. Browser Client (`client.ts`)

**Where it lives**: `supabase/client.ts`

**What it does**: Creates a Supabase client that runs in the browser.

```typescript
// File: supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
```

**How to use it**:

```typescript
// In a React Component
'use client'

import { createClient } from '@/supabase/client'

export default function UserProfile() {
    const supabase = createClient()
    
    // Read user profile
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    
    // Update profile
    const { data } = await supabase
        .from('profiles')
        .update({ bio: 'New bio' })
        .eq('id', userId)
}
```

**Auth Handling**: 
- Cookies are automatically managed by the browser
- Supabase reads `sb-access-token` and `sb-refresh-token` cookies
- When tokens expire, Supabase automatically refreshes them

**Key Points**:
- ✅ Use in `'use client'` components
- ✅ Safe to use `NEXT_PUBLIC_*` variables
- ✅ Auth is automatic via cookies
- ❌ Don't use in Server Components
- ❌ Don't use in Server Actions (use `server.ts` instead)

**Use Cases**:
- Reading data for UI
- Updating user profile
- Uploading files
- Real-time subscriptions
- Sign-up forms

---

### 2. Middleware Client (`middleware.ts`)

**Where it lives**: `supabase/middleware.ts`

**What it does**: Creates a Supabase client that runs in Next.js Middleware (edge runtime). Used to:
1. Protect routes (redirect unauthenticated users)
2. Refresh authentication tokens
3. Sync auth state across requests

```typescript
// File: supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Check if user is authenticated
    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Protect admin routes
    if (request.nextUrl.pathname.startsWith('/admin') && !user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        const response = NextResponse.redirect(url)
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            response.cookies.set(cookie)
        })
        return response
    }

    return supabaseResponse
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**How it works**:

1. **On every request**: Middleware runs BEFORE the page loads
2. **Reads cookies**: Gets auth tokens from browser cookies
3. **Refreshes tokens**: If token expired, Supabase auto-refreshes it
4. **Checks protection**: If route requires auth and user isn't logged in, redirects to login
5. **Syncs cookies**: Updated cookies are sent back to browser

**Key Points**:
- ✅ Runs on every request (automatic auth refresh)
- ✅ Protects routes BEFORE page loads
- ✅ Handles token refresh transparently
- ⚠️ All route matchers that DON'T need protection should be in config.matcher exceptions
- ❌ Can't modify database or perform mutations

**Use Cases**:
- Redirect unauthenticated users to /login
- Refresh authentication tokens
- Block access to admin routes
- Sync authentication state

**Example: Protect All Routes Except Public Ones**

```typescript
// middleware.ts - Matcher explanation

export const config = {
    // This runs middleware on ALL routes EXCEPT:
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
        // Except: static assets, images, favicon
    ],
}

// So if user visits /admin and isn't logged in:
// middleware.ts checks auth → redirects to /login ✅
```

---

### 3. Server Client (`server.ts`)

**Where it lives**: `supabase/server.ts`

**What it does**: Creates a Supabase client for Server Actions and Server Components. This client reads cookies server-side.

```typescript
// File: supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/hooks'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Ignored - happens in Server Components
                    }
                },
            },
        }
    )
}
```

**How to use it in Server Actions**:

```typescript
// File: app/login/actions.ts
'use server'

import { createClient } from '@/supabase/server'

export async function loginUser(email: string, password: string) {
    const supabase = await createClient()
    
    // Authenticate user
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })
    
    return { data, error }
}
```

**Auth Handling**:
- Reads auth cookies from server-side cookie store
- User is automatically identified via cookies
- When mutations happen, tokens are automatically refreshed

**Key Points**:
- ✅ Use in `'use server'` Server Actions
- ✅ Use in Server Components (if needed)
- ✅ Can access authenticated user via cookies
- ✅ Handles token refresh automatically
- ❌ Don't use in Client Components

**Use Cases**:
- Server Actions (form submissions)
- Protected database mutations
- Authentication (login, signup, logout)
- Server-side queries that need auth

---

## Authentication Architecture

### How Auth Works (Cookie-Based, NO localStorage)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
├──────────────────────────┬──────────────────────────────────┤
│  Components              │  Cookies (secure, automatic)     │
│  (read from cookies)     │  - sb-access-token               │
│                          │  - sb-refresh-token              │
└────────────────────┬─────┴──────────────────────────────────┘
                     │
                     │ request with cookies
                     │
        ┌────────────▼──────────────┐
        │  Next.js Server           │
        │  - middleware.ts          │
        │  - server.ts              │
        │  (read cookies server)    │
        └────────────┬──────────────┘
                     │
                     │ authenticated request
                     │
        ┌────────────▼──────────────┐
        │  Supabase                 │
        │  - Verifies token         │
        │  - Checks user in db      │
        │  - Applies RLS policies   │
        └──────────────────────────┘
```

### Why NOT localStorage?

❌ **LocalStorage** (WRONG):
```javascript
// BAD - Don't do this!
localStorage.setItem('token', authToken)  // Vulnerable to XSS!
```
- Vulnerable to cross-site scripting (XSS) attacks
- Any malicious script can access the token
- Attacker can steal user data

✅ **Cookies** (CORRECT):
```javascript
// GOOD - This is automatic in Supabase
// Cookies are:
// - httpOnly (can't be accessed by JS)
// - Secure (only sent over HTTPS)
// - SameSite (protection against CSRF)
```
- Cannot be accessed by JavaScript (httpOnly flag)
- Automatically sent with requests
- Protected against cross-site attacks
- Server-side only access

### Auth Flow in Your App

1. **User submits login form**
   ```typescript
   // app/login/actions.ts
   'use server'
   
   export async function loginAction(email: string, password: string) {
       const supabase = await createClient()
       
       // Authenticate
       const { data, error } = await supabase.auth.signInWithPassword({
           email,
           password,
       })
       
       // Supabase automatically sets cookies here!
       // (no manual localStorage needed)
   }
   ```

2. **Supabase sets cookies in response**
   - `sb-access-token` (short-lived, 1 hour)
   - `sb-refresh-token` (long-lived, 7 days)
   - Browser automatically stores in secure cookie storage

3. **Next request includes cookies**
   - Browser automatically sends cookies with request
   - Middleware checks auth via cookies
   - Server actions access user via cookies

4. **Token expires? Auto-refresh happens**
   - Middleware detects expired token
   - Calls Supabase to refresh
   - New token set in cookies
   - User never notices ✅

### Example: Complete Login Flow

```typescript
// File: app/login/page.tsx
'use client'

import { loginAction } from './actions'

export default function LoginPage() {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        
        // Call server action
        const result = await loginAction(
            formData.get('email') as string,
            formData.get('password') as string
        )
        
        if (result.error) {
            console.error('Login failed:', result.error.message)
            return
        }
        
        // User is now authenticated!
        // Cookies are set automatically
        // Middleware will allow access to protected routes
        redirect('/dashboard')
    }

    return (
        <form onSubmit={handleSubmit}>
            <input type="email" name="email" required />
            <input type="password" name="password" required />
            <button type="submit">Login</button>
        </form>
    )
}

// File: app/login/actions.ts
'use server'

import { createClient } from '@/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(email: string, password: string) {
    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })
    
    if (error) {
        return { error }
    }
    
    // Cookies are automatically set by Supabase!
    // Next middleware will see the authenticated user
    
    return { data }
}
```

---

## The Golden Flow

This is how data should flow in your app. **NEVER deviate from this pattern.**

```
┌─────────────────────────────────────────────────────────────────┐
│ UI Component (page.tsx, client component)                       │
│ - Displays data                                                 │
│ - Handles user interactions                                     │
└────────────────┬────────────────────────────────────────────────┘
                 │ calls
                 │
┌────────────────▼────────────────────────────────────────────────┐
│ Zustand Store (useGuideStore, useAuthStore, etc)                │
│ - Manages application state                                     │
│ - Calls service layer                                           │
│ - Provides getters and actions                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │ calls
                 │
┌────────────────▼────────────────────────────────────────────────┐
│ Service Layer (guideService.ts, authService.ts, etc)            │
│ - Business logic                                                │
│ - Data validation via Zod                                       │
│ - Calls Supabase                                                │
│ - Error handling & wrapping                                     │
└────────────────┬────────────────────────────────────────────────┘
                 │ uses (client.ts or server.ts)
                 │
┌────────────────▼────────────────────────────────────────────────┐
│ Supabase Clients (client.ts, server.ts, middleware.ts)          │
│ - Browser Client: UI state, reads, non-sensitive mutations      │
│ - Server Client: Auth mutations, database writes                │
│ - Middleware: Route protection, token refresh                   │
└─────────────────────────────────────────────────────────────────┘
```

### ✅ CORRECT PATTERN

```typescript
// components/guide-detail.tsx
'use client'

import { useGuideStore } from '@/backend/stores/useGuideStore'

export default function GuideDetail() {
    const { fetchGuideDetail } = useGuideStore()
    
    const handleLoadGuide = () => {
        fetchGuideDetail(guideId)  // ✅ Goes through store → service → Supabase
    }
}

// backend/stores/useGuideStore.ts
export const useGuideStore = create((set) => ({
    async fetchGuideDetail(id: string) {
        const result = await guideService.getGuideDetail(id)  // ✅ Calls service
        set({ currentGuide: result.data })
    },
}))

// backend/services/guideService.ts
export class GuideService extends SupabaseService {
    async getGuideDetail(id: string) {
        return this.execute(
            async () => {
                const client = createClient()  // ✅ Uses appropriate client
                const { data } = await client
                    .from('guides')
                    .select('*')
                    .eq('id', id)
                    .single()
                return data
            }
        )
    }
}
```

### ❌ WRONG PATTERNS (DON'T DO THIS)

```typescript
// ❌ WRONG 1: Direct Supabase in Component
'use client'
import { createClient } from '@/supabase/client'

export default function Bad1() {
    const supabase = createClient()
    
    // ❌ NO - Talk directly to database, bypasses validation!
    const { data } = await supabase
        .from('guides')
        .select('*')
}

// ❌ WRONG 2: Importing Browser Client in Server Action
'use server'
import { createClient } from '@/supabase/client'  // ❌ WRONG

export async function badServerAction() {
    // ❌ NO - Can't use browser client in server!
    const supabase = createClient()
}

// ❌ WRONG 3: Accessing Store from Another Store
export const useGuideStore = create((set) => ({
    async fetchGuide() {
        // ❌ NO - Don't call other stores directly
        const authStore = useAuthStore()
        authStore.logout()  // Wrong pattern!
    },
}))

// ✅ RIGHT - Get data from auth store via state check
export const useGuideStore = create((set, get) => ({
    async fetchGuide() {
        const auth = useAuthStore.getState()  // ✅ Get state if absolutely needed
        if (!auth.is_logged_in()) {
            return { error: 'Not authenticated' }
        }
    },
}))
```

---

## Common Patterns

### Pattern 1: Fetch Data in Client Component

```typescript
// components/stories/story-list.tsx
'use client'

import { useEffect } from 'react'
import { useStoryStore } from '@/backend/stores/useStoryStore'

export default function StoryList() {
    const { stories, isLoading, fetchStories } = useStoryStore()
    
    useEffect(() => {
        fetchStories()  // Load stories on mount
    }, [])
    
    if (isLoading) return <div>Loading...</div>
    
    return (
        <div>
            {stories.map(story => (
                <div key={story.id}>{story.title}</div>
            ))}
        </div>
    )
}
```

### Pattern 2: Update User Data in Server Action

```typescript
// app/profile/actions.ts
'use server'

import { createClient } from '@/supabase/server'

export async function updateProfile(updates: ProfileUpdate) {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        return { error: 'Not authenticated' }
    }
    
    // Update profile
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
    
    return { data, error }
}

// components/profile-form.tsx
'use client'

import { updateProfile } from '@/app/profile/actions'

export default function ProfileForm() {
    const handleSubmit = async (formData: FormData) => {
        const result = await updateProfile({
            bio: formData.get('bio'),
            avatar_url: formData.get('avatar'),
        })
        
        if (result.error) {
            console.error('Failed to update profile')
        }
    }
    
    return (
        <form action={handleSubmit}>
            <input name="bio" />
            <input name="avatar" type="file" />
            <button>Save</button>
        </form>
    )
}
```

### Pattern 3: Check User Authentication

```typescript
// components/protected-component.tsx
'use client'

import { useAuthStore } from '@/backend/stores/useAuthStore'

export default function ProtectedComponent() {
    const { completeProfile, is_logged_in } = useAuthStore()
    
    // Check if user is logged in
    if (!is_logged_in()) {
        return <div>Please log in first</div>
    }
    
    // Use user data
    return (
        <div>
            <h1>Welcome, {completeProfile?.name}</h1>
        </div>
    )
}
```

### Pattern 4: Handle Server Action with Validation

```typescript
// app/stories/actions.ts
'use server'

import { createClient } from '@/supabase/server'
import { z } from 'zod'

const CreateStorySchema = z.object({
    title: z.string().min(5).max(100),
    description: z.string().min(20).max(5000),
})

export async function createStory(formData: FormData) {
    // Validate input
    const validation = CreateStorySchema.safeParse({
        title: formData.get('title'),
        description: formData.get('description'),
    })
    
    if (!validation.success) {
        return {
            error: 'Validation failed',
            errors: validation.error.flatten(),
        }
    }
    
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        return { error: 'Not authenticated' }
    }
    
    // Create story
    const { data, error } = await supabase
        .from('stories')
        .insert({
            title: validation.data.title,
            description: validation.data.description,
            author_id: user.id,
        })
        .select()
        .single()
    
    return { data, error: error?.message }
}
```

---

## Common Mistakes and Fixes

### ❌ Mistake 1: Using Browser Client in Server Action

```typescript
// ❌ WRONG
'use server'

import { createClient } from '@/supabase/client'  // ❌ WRONG CLIENT

export async function updateData(id: string) {
    const supabase = createClient()  // ❌ This is a browser client!
    // This will fail because browser client doesn't work in server
}

// ✅ CORRECT
'use server'

import { createClient } from '@/supabase/server'  // ✅ RIGHT CLIENT

export async function updateData(id: string) {
    const supabase = await createClient()  // ✅ Server client
    // Now it works!
}
```

### ❌ Mistake 2: Storing Auth Token in localStorage

```typescript
// ❌ WRONG
'use client'

const { data } = await supabase.auth.signInWithPassword({ email, password })
localStorage.setItem('token', data.session.access_token)  // ❌ INSECURE!

// Later:
const token = localStorage.getItem('token')  // ❌ XSS vulnerability!

// ✅ CORRECT
'use server'

const { data, error } = await supabase.auth.signInWithPassword({ email, password })
// Supabase automatically sets cookies! No manual storage needed.
// Cookies are httpOnly and secure. 🔒
```

### ❌ Mistake 3: Creating Multiple Client Instances

```typescript
// ❌ WRONG
'use client'

export default function Component1() {
    const supabase1 = createClient()  // ❌ New instance
    const supabase2 = createClient()  // ❌ Different instance
    
    // These are different instances - auth tokens might be out of sync!
}

// ✅ CORRECT
'use client'

// Create once
const supabase = createClient()

export default function Component1() {
    // Reuse it
    supabase.from('table').select()
}

// Or use through stores
export default function Component2() {
    const { guides, fetchGuides } = useGuideStore()
    // The store handles the client internally ✅
}
```

### ❌ Mistake 4: Hardcoding Supabase Keys in Code

```typescript
// ❌ WRONG
const supabase = createBrowserClient(
    'https://hardcoded.supabase.co',  // ❌ Don't hardcode!
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // ❌ Never hardcode!
)

// ✅ CORRECT
const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,      // ✅ From env
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // ✅ From env
)
```

### ❌ Mistake 5: Forgetting Async/Await

```typescript
// ❌ WRONG
'use server'

export async function getData() {
    const supabase = createClient()  // ❌ Not awaited!
    // This will return a Promise, not a client
}

// ✅ CORRECT
'use server'

export async function getData() {
    const supabase = await createClient()  // ✅ Awaited!
    // Now it's a real client instance
}
```

### ❌ Mistake 6: Not Checking Authentication Before Operations

```typescript
// ❌ WRONG
'use server'

export async function deleteStory(storyId: string) {
    const supabase = await createClient()
    
    // ❌ What if user isn't logged in?
    // Database RLS will reject, but it's bad practice
    const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)
    
    return error
}

// ✅ CORRECT
'use server'

export async function deleteStory(storyId: string) {
    const supabase = await createClient()
    
    // Check auth first
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        return { error: 'Not authenticated' }
    }
    
    // Verify ownership via RLS (database will reject if not owner)
    const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)
        .eq('author_id', user.id)  // Ensure user owns it
    
    return { error }
}
```

### ❌ Mistake 7: Making Direct Database Calls from Components

```typescript
// ❌ WRONG - Bypasses validation and business logic
'use client'

import { createClient } from '@/supabase/client'

export default function GuideList() {
    const supabase = createClient()
    
    // ❌ Direct database access - no validation!
    useEffect(() => {
        supabase.from('guides').select('*').then(setGuides)
    }, [])
}

// ✅ CORRECT - Use store (which uses service → supabase)
'use client'

import { useGuideStore } from '@/backend/stores/useGuideStore'

export default function GuideList() {
    const { guides, fetchGuides } = useGuideStore()
    
    // ✅ Goes through: Component → Store → Service → Supabase
    useEffect(() => {
        fetchGuides()
    }, [])
}
```

---

## Quick Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│ Which file should I import the client from?                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Am I in a React Component (page.tsx, component.tsx)?       │
│  └─→ YES: @/supabase/client                               │
│  └─→ NO: Go to next question                              │
│                                                             │
│  Is this code in middleware.ts?                            │
│  └─→ YES: Use the createServerClient directly            │
│  └─→ NO: Go to next question                              │
│                                                             │
│  Am I in a Server Action ('use server')?                   │
│  └─→ YES: @/supabase/server                               │
│  └─→ NO: You're probably in a component                   │
│                                                             │
│  Is this a TypeScript/Zod schema validation?              │
│  └─→ YES: No Supabase client needed here                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## File-by-File Summary

### `supabase/client.ts`
- **Purpose**: Browser Supabase client
- **Use**: React components ('use client')
- **Auth**: Automatic via cookies
- **Import**: `import { createClient } from '@/supabase/client'`

### `supabase/server.ts`
- **Purpose**: Server Supabase client
- **Use**: Server Actions ('use server'), Server Components
- **Auth**: Reads from server-side cookies
- **Import**: `import { createClient } from '@/supabase/server'` (remember `await`)

### `supabase/middleware.ts`
- **Purpose**: Auth token refresh, route protection
- **Use**: Next.js middleware (runs on every request)
- **Auth**: Reads/refreshes cookies in request/response
- **Where**: `middleware.ts` file in root

### `supabase/schemas.ts`
- **Purpose**: Base interfaces for type safety
- **Use**: Service layer for generic typing
- **Contains**: `BaseEntity` (id, created_at)

### `supabase/supabaseService.ts`
- **Purpose**: Generic service base class with validation, error handling, file uploads
- **Use**: Extend this to create domain-specific services
- **Features**:
  - Automatic Zod validation
  - Consistent error handling via `ServiceResult<T>`
  - File upload handling (public & confidential)
  - Real-time subscriptions setup
  - PostGIS helpers

---

## Troubleshooting

### "Auth user is null when it shouldn't be"
- Check that middleware.ts is running (check Network tab in DevTools)
- Verify cookies exist (Application → Cookies)
- Ensure the route isn't excluded from middleware matcher
- Confirm user actually logged in successfully

### "Cookies not being set after login"
- Ensure you're using `server.ts` for login (not `client.ts`)
- Verify Supabase URL and anon key are correct in `.env.local`
- Check that auth response has `session` and `user` data

### "Can't read user in Server Action"
- Use `await` when calling `createClient()` in server.ts
- Verify the user actually logged in (check auth cookies)
- Make sure you're calling `getUser()` after client creation

### "Browser client works but server action fails"
- You might be using `client.ts` instead of `server.ts`
- Remember to `await createClient()` in server.ts
- Check that you're actually in a Server Action ('use server')

---

## Next Steps

1. **Copy `.env.local` template** to your project root
2. **Fill in your Supabase credentials** from the Supabase dashboard
3. **Import clients correctly** based on location (component vs server)
4. **Use Zustand stores** instead of direct Supabase calls
5. **Test authentication** by logging in and checking cookies
6. **Enable middleware** to protect routes automatically

**You're ready to build securely!** 🚀
