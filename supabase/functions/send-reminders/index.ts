// Supabase Edge Function: send-reminders
// Called hourly by pg_cron (cron.sql). For every user with a push
// subscription, once their local time is past 9 AM, sends the renewal
// reminders due today. sent_reminders makes each one go out only once.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { dueReminders, parseDateValue, reminderMessage } from './shared.generated.js';

const SEND_FROM_HOUR = 9;

function localDay(timeZone: string, now: Date) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
        }).formatToParts(now).map(p => [p.type, p.value]),
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

Deno.serve(async req => {
    if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
        return new Response('unauthorized', { status: 401 });
    }
    webpush.setVapidDetails(
        Deno.env.get('VAPID_SUBJECT')!,
        Deno.env.get('VAPID_PUBLIC')!,
        Deno.env.get('VAPID_PRIVATE')!,
    );
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: pushSubs, error: pushErr } = await sb.from('push_subscriptions').select('*');
    if (pushErr) return Response.json({ error: pushErr.message }, { status: 500 });
    const userIds = [...new Set((pushSubs ?? []).map(p => p.user_id))];
    if (!userIds.length) return Response.json({ users: 0, sent: 0 });

    const [{ data: profiles }, { data: subs }] = await Promise.all([
        sb.from('profiles').select('user_id, timezone').in('user_id', userIds),
        sb.from('subscriptions').select('*').in('user_id', userIds).eq('paused', false).neq('reminder', 'none'),
    ]);
    const tzOf = new Map((profiles ?? []).map(p => [p.user_id, p.timezone || 'Asia/Kolkata']));

    const now = new Date();
    let sent = 0;
    let due = 0;
    for (const userId of userIds) {
        const { date, hour } = localDay(tzOf.get(userId) ?? 'Asia/Kolkata', now);
        if (hour < SEND_FROM_HOUR) continue;

        const mine = (subs ?? []).filter(s => s.user_id === userId).map(s => ({
            id: s.id, name: s.name, price: s.price, cycle: s.cycle, reminder: s.reminder, paused: s.paused,
            startDate: s.start_date, dateAdded: s.date_added,
        }));
        for (const reminder of dueReminders(mine, parseDateValue(date))) {
            due++;
            // The primary key makes this fail if the reminder already went out.
            const { error: dupe } = await sb.from('sent_reminders').insert({
                user_id: userId,
                subscription_id: reminder.sub.id,
                renewal_date: reminder.renewalDate,
                days_before: reminder.daysBefore,
            });
            if (dupe) continue;

            const payload = JSON.stringify(reminderMessage(reminder));
            let delivered = 0;
            let retryable = 0;
            for (const p of (pushSubs ?? []).filter(p => p.user_id === userId)) {
                try {
                    await webpush.sendNotification({ endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } }, payload);
                    delivered++;
                } catch (err) {
                    const status = (err as { statusCode?: number }).statusCode;
                    if (status === 404 || status === 410) {
                        // The browser dropped this subscription; forget it.
                        await sb.from('push_subscriptions').delete().eq('endpoint', p.endpoint);
                    } else {
                        retryable++;
                        console.error('push failed', status, err);
                    }
                }
            }
            sent += delivered;
            // Nothing reached the user but a retry might: un-mark it so the
            // next hourly run tries again.
            if (!delivered && retryable) {
                await sb.from('sent_reminders').delete()
                    .eq('subscription_id', reminder.sub.id)
                    .eq('renewal_date', reminder.renewalDate)
                    .eq('days_before', reminder.daysBefore);
            }
        }
    }
    return Response.json({ users: userIds.length, due, sent });
});
