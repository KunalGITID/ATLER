// send-reminders-v2: run hourly by pg_cron. For each device registered by the
// v2 app, once it's past 9 AM in that device's time zone, push the reminders
// due today. It uses the app's own src/core, so the server decides exactly
// like the app. sent_reminders stops repeats; a delivery that fails for a
// retryable reason is un-marked so the next hour tries again.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { parseDay, type Day } from '../../../src/core/dates.ts';
import type { Plan, PlanEvent } from '../../../src/core/model.ts';
import { dueReminders, reminderText } from '../../../src/core/reminders.ts';
import { tables, type Remote } from '../../../src/data/syncMap.ts';

const SEND_FROM_HOUR = 9;
const PAGE = 1000;
const USERS_PER_QUERY = 100;

function localNow(timeZone: string, now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { day: parseDay(`${parts.year}-${parts.month}-${parts.day}`) as Day, hour: Number(parts.hour) };
}

Deno.serve(async req => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('unauthorized', { status: 401 });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const devices: Array<Record<string, any>> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from('push_subscriptions').select('*').eq('app', 2).order('endpoint').range(from, from + PAGE - 1);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    devices.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const userIds = [...new Set(devices.map(d => d.user_id as string))];
  if (!userIds.length) return Response.json({ users: 0, due: 0, sent: 0 });

  // PostgREST returns at most 1,000 rows per request, so read page by page,
  // and a few users at a time to keep each URL short.
  type Row = Record<string, unknown>;
  async function readAll(table: string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let u = 0; u < userIds.length; u += USERS_PER_QUERY) {
      const some = userIds.slice(u, u + USERS_PER_QUERY);
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb.from(table).select('*').in('user_id', some).eq('deleted', false).order('id').range(from, from + PAGE - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
    }
    return rows;
  }
  let planRows: Row[];
  let eventRows: Row[];
  try {
    [planRows, eventRows] = await Promise.all([readAll('plans'), readAll('plan_events')]);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  const plansOf = (u: string) => planRows.filter(r => r.user_id === u).map(r => tables.plans.fromRemote(r as unknown as Remote) as Plan);
  const eventsOf = (u: string) => eventRows.filter(r => r.user_id === u).map(r => tables.events.fromRemote(r as unknown as Remote) as PlanEvent);

  const now = new Date();
  let due = 0;
  let sent = 0;
  for (const userId of userIds) {
    const mine = devices.filter(d => d.user_id === userId);
    const { day, hour } = localNow(mine[0]?.timezone || 'Asia/Kolkata', now);
    if (hour < SEND_FROM_HOUR) continue;

    for (const reminder of dueReminders(plansOf(userId), eventsOf(userId), day)) {
      due++;
      const { error: already } = await sb.from('sent_reminders').insert({
        user_id: userId, subscription_id: reminder.plan.id, renewal_date: reminder.on, days_before: reminder.daysBefore,
      });
      if (already) continue;

      const payload = JSON.stringify({ ...reminderText(reminder), planId: reminder.plan.id });
      let delivered = 0;
      let retryable = 0;
      for (const d of mine) {
        try {
          await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload);
          delivered++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await sb.from('push_subscriptions').delete().eq('endpoint', d.endpoint);
          else retryable++;
        }
      }
      sent += delivered;
      if (!delivered && retryable) {
        await sb.from('sent_reminders').delete()
          .eq('subscription_id', reminder.plan.id).eq('renewal_date', reminder.on).eq('days_before', reminder.daysBefore);
      }
    }
  }
  return Response.json({ users: userIds.length, due, sent });
});
