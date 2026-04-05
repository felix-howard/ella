/**
 * Supabase helpers for Realtime Broadcast
 * Uses service role key for server-side publishing
 */
import { config } from './config'

export function getSupabaseUrl(): string {
  return config.supabase.url
}

export function getSupabaseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': config.supabase.serviceRoleKey,
    'Authorization': `Bearer ${config.supabase.serviceRoleKey}`,
  }
}

export function isSupabaseConfigured(): boolean {
  return config.supabase.isConfigured
}
