/**
 * File: supabase/client.ts
 * 
 * This file is used to create a Supabase client for client-side operations.
 * It uses the createBrowserClient function from the @supabase/ssr package.
 * 
 * @returns {Promise<SupabaseClient>} - The Supabase client
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

