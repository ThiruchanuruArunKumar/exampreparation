// Server-side Supabase client with service role key - bypasses RLS.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import fs from 'fs';
import path from 'path';

function getEnvVar(name: string): string {
  if (process.env[name]) return process.env[name]!;
  if (process.env[`VITE_${name}`]) return process.env[`VITE_${name}`]!;

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const k = trimmed.substring(0, idx).trim();
            const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
            if ((k === name || k === `VITE_${name}`) && v) return v;
          }
        }
      }
    }
  } catch {}

  return '';
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = getEnvVar('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY =
    getEnvVar('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnvVar('SUPABASE_ANON_KEY') ||
    getEnvVar('LOVABLE_API_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(`[Supabase] Missing Supabase environment variables. Using fallback mode.`);
    return createClient<Database>(
      SUPABASE_URL || 'https://placeholder.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
      {
        global: { fetch },
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      },
    );
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
