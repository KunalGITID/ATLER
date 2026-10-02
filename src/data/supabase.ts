import { createClient } from '@supabase/supabase-js';

// The anon key is public by design; row-level security protects the data.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://cnxurdingdhhdcjgujkz.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNueHVyZGluZ2RoaGRjamd1amt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQ1OTIsImV4cCI6MjA5MDQ1MDU5Mn0.nX0-MR9C1fmKRA9lHw0FBp_r0LYYlntbz9B7BW7HKd8';

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Deletes the signed-in user and everything they stored (see the
// delete-account Edge Function).
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error || !(data as { deleted?: boolean } | null)?.deleted) throw new Error('Could not delete the account. Try again.', { cause: error });
}
