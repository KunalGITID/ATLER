// Where to cancel a plan. Links go to the provider's own account page; the
// steps are the short version. Anything bought through an app store is
// cancelled in that store, so those links are always offered too.
export interface CancelHelp { url: string | null; steps: string }

const GUIDES: Array<[RegExp, CancelHelp]> = [
  [/netflix/i, { url: 'https://www.netflix.com/cancelplan', steps: 'Account → Membership → Cancel membership.' }],
  [/spotify/i, { url: 'https://www.spotify.com/account/subscription/', steps: 'Account → Your plan → Change plan → Cancel Premium.' }],
  [/youtube/i, { url: 'https://www.youtube.com/paid_memberships', steps: 'Purchases and memberships → Manage membership → Deactivate.' }],
  [/amazon ?prime|prime ?video/i, { url: 'https://www.amazon.in/gp/primecentral', steps: 'Manage Prime membership → End membership.' }],
  [/hotstar/i, { url: 'https://www.hotstar.com/in/mypage', steps: 'My Space → Subscription → Cancel auto-renew.' }],
  [/sony ?liv/i, { url: 'https://www.sonyliv.com/myaccount', steps: 'My account → Subscription → Cancel auto-renewal.' }],
  [/zee5/i, { url: 'https://www.zee5.com/myaccount/subscription', steps: 'My subscription → Cancel renewal.' }],
  [/apple|icloud/i, { url: 'https://apps.apple.com/account/subscriptions', steps: 'Settings → your name → Subscriptions → pick it → Cancel.' }],
  [/google ?one|google ?play|gemini/i, { url: 'https://play.google.com/store/account/subscriptions', steps: 'Play Store → Payments & subscriptions → Subscriptions → Cancel.' }],
  [/chatgpt|openai/i, { url: 'https://chatgpt.com/#settings/Subscription', steps: 'Settings → Subscription → Manage → Cancel plan.' }],
  [/claude/i, { url: 'https://claude.ai/settings/billing', steps: 'Settings → Billing → Cancel plan.' }],
  [/microsoft|office|xbox|onedrive/i, { url: 'https://account.microsoft.com/services', steps: 'Services & subscriptions → Manage → Cancel.' }],
  [/adobe/i, { url: 'https://account.adobe.com/plans', steps: 'Plans → Manage plan → Cancel your plan (an annual plan may charge a fee).' }],
  [/canva/i, { url: 'https://www.canva.com/settings/billing-and-plans', steps: 'Settings → Billing & plans → Cancel subscription.' }],
  [/linkedin/i, { url: 'https://www.linkedin.com/premium/manage', steps: 'Premium features → Manage → Cancel subscription.' }],
  [/audible/i, { url: 'https://www.audible.in/account/overview', steps: 'Account details → Cancel membership.' }],
  [/github/i, { url: 'https://github.com/settings/billing', steps: 'Settings → Billing and plans → Downgrade or cancel.' }],
  [/notion/i, { url: null, steps: 'In Notion: Settings → Billing → Change plan → Downgrade.' }],
  [/swiggy/i, { url: null, steps: 'In the Swiggy app: Account → Swiggy One → Cancel auto-renew.' }],
  [/zomato/i, { url: null, steps: 'In the Zomato app: Profile → Gold → Manage membership.' }],
  [/cult/i, { url: null, steps: 'In the cult.fit app: Profile → Memberships → Pause or cancel.' }],
  [/duolingo/i, { url: null, steps: 'Cancel where you subscribed: the Play Store or App Store (links below).' }],
  [/jio|airtel|\bvi\b|vodafone|bsnl/i, { url: null, steps: 'Prepaid plans simply end if you don’t recharge. For postpaid or autopay, turn it off in the operator’s app.' }],
];

export const STORES = [
  { label: 'Google Play subscriptions', url: 'https://play.google.com/store/account/subscriptions' },
  { label: 'App Store subscriptions', url: 'https://apps.apple.com/account/subscriptions' },
];

export function cancelHelp(name: string): CancelHelp {
  return GUIDES.find(([re]) => re.test(name))?.[1]
    ?? { url: null, steps: 'Look for Account → Subscription or Membership in its app or website. Paid through UPI autopay? Also revoke the mandate in your UPI app.' };
}
