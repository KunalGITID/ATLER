// delete-account: deletes the signed-in user. Every table holding their data
// references auth.users with ON DELETE CASCADE (error_log: SET NULL), so
// removing the user removes all of it — v1 and v2 alike — after their
// profile photo is removed from storage.
// Deployed with JWT verification on: only a signed-in user can call it, and
// only for themselves (the user comes from their own token).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return Response.json({ error: 'not signed in' }, { status: 401, headers: cors });
  // Files aren't rows: remove the profile photo first.
  const { data: files } = await admin.storage.from('avatars').list(data.user.id);
  if (files?.length) await admin.storage.from('avatars').remove(files.map(f => `${data.user.id}/${f.name}`));
  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) return Response.json({ error: delError.message }, { status: 500, headers: cors });
  return Response.json({ deleted: true }, { headers: cors });
});
