# send-reminders: deploy runbook

Sends renewal reminders as Web Push notifications, so they arrive even when
Atler is closed. Runs hourly; each user gets theirs after 9 AM in their own
time zone, and `sent_reminders` stops repeats.

## One-time setup
1. **Migration:** run `supabase/migrations/004_push_reminders.sql` in the SQL editor.
2. **Secrets.** The VAPID public key is in `src/lib/push.js`; the private key is
   kept outside git (it was generated into `~/.config/atler/vapid.json`).
   ```bash
   supabase secrets set --project-ref cnxurdingdhhdcjgujkz \
     VAPID_PUBLIC="<publicKey>" VAPID_PRIVATE="<privateKey>" \
     VAPID_SUBJECT="mailto:<your email>" CRON_SECRET="<long random string>"
   ```
3. **Deploy.** The scheduler sends a secret header instead of a user JWT:
   ```bash
   supabase functions deploy send-reminders --project-ref cnxurdingdhhdcjgujkz --no-verify-jwt
   ```
4. **Schedule:** put the CRON_SECRET into `cron.sql` and run it in the SQL editor.

Try it without waiting for the hour:
```bash
curl -X POST https://cnxurdingdhhdcjgujkz.supabase.co/functions/v1/send-reminders \
  -H "x-cron-secret: <CRON_SECRET>"
# {"users":N,"due":N,"sent":N}
```

## Changing the date or reminder logic
The function uses a generated copy of `src/lib/dates.js` and
`src/lib/reminders.js`. After editing either:
```bash
node scripts/gen-edge-shared.mjs
supabase functions deploy send-reminders --project-ref cnxurdingdhhdcjgujkz --no-verify-jwt
```
`test/edge-shared.test.js` fails CI if the copy is stale.

## On a phone
iPhone: Share → Add to Home Screen first (iOS only allows push for installed
web apps). Then Profile → Notifications → Enable.
