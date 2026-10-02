// Turning a bank narration into a merchant name. Kept apart from
// statement.ts so screens that only need a name don't load the subscription model.

const KNOWN: Array<[RegExp, string]> = [
  [/netflix/i, 'Netflix'], [/spotify/i, 'Spotify'], [/youtube|google ?youtube|yt ?premium/i, 'YouTube Premium'],
  [/prime ?video|amazon ?prime|primevideo/i, 'Amazon Prime'], [/hotstar|jiohotstar|disney/i, 'JioHotstar'],
  [/jiocinema/i, 'JioCinema'], [/sonyliv|sony ?liv/i, 'SonyLIV'], [/zee5/i, 'ZEE5'],
  [/apple\.com|itunes|apple ?services/i, 'Apple'], [/google ?(one|storage)|google ?play/i, 'Google One / Play'],
  [/openai|chatgpt/i, 'ChatGPT'], [/anthropic|claude\.ai/i, 'Claude'], [/github/i, 'GitHub'],
  [/microsoft|msft|office ?365|xbox/i, 'Microsoft'], [/adobe/i, 'Adobe'], [/canva/i, 'Canva'], [/notion/i, 'Notion'],
  [/swiggy ?one/i, 'Swiggy One'], [/zomato ?(gold|pro)/i, 'Zomato Gold'],
  [/airtel/i, 'Airtel'], [/jio(?!hotstar|cinema)/i, 'Jio'], [/\bvi\b|vodafone|idea cellular/i, 'Vi'],
  [/bsnl/i, 'BSNL'], [/act ?fibernet/i, 'ACT Fibernet'], [/tata ?play|tatasky/i, 'Tata Play'],
  [/cult\.?fit|cultfit|curefit/i, 'cult.fit'], [/linkedin/i, 'LinkedIn'], [/duolingo/i, 'Duolingo'],
  [/audible/i, 'Audible'], [/kindle/i, 'Kindle'], [/coursera/i, 'Coursera'], [/udemy/i, 'Udemy'],
  // Everyday merchants, so "UPI/DR/4029/ZOMATO/HDFC" reads as Zomato.
  [/instamart/i, 'Swiggy Instamart'], [/swiggy/i, 'Swiggy'], [/zomato/i, 'Zomato'], [/blinkit|grofers/i, 'Blinkit'],
  [/zepto/i, 'Zepto'], [/bigbasket|bb ?daily/i, 'BigBasket'], [/dunzo/i, 'Dunzo'], [/domino/i, "Domino's"],
  [/mcdonald/i, "McDonald's"], [/\bkfc\b/i, 'KFC'], [/starbucks/i, 'Starbucks'], [/uber/i, 'Uber'], [/\bola\b|olacabs/i, 'Ola'],
  [/rapido/i, 'Rapido'], [/irctc/i, 'IRCTC'], [/redbus/i, 'redBus'], [/makemytrip/i, 'MakeMyTrip'], [/indigo/i, 'IndiGo'],
  [/amazon ?pay/i, 'Amazon Pay'], [/amazon|amzn/i, 'Amazon'], [/flipkart/i, 'Flipkart'], [/myntra/i, 'Myntra'], [/ajio/i, 'AJIO'],
  [/meesho/i, 'Meesho'], [/nykaa/i, 'Nykaa'], [/decathlon/i, 'Decathlon'], [/croma/i, 'Croma'], [/dmart|avenue supermarts/i, 'DMart'],
  [/bookmyshow/i, 'BookMyShow'], [/\bpvr\b/i, 'PVR'], [/apollo/i, 'Apollo'], [/pharmeasy/i, 'PharmEasy'], [/\b1mg\b|tata ?1mg/i, 'Tata 1mg'],
  [/indian ?oil|iocl/i, 'Indian Oil'], [/\bhpcl\b|hindustan petroleum/i, 'HP Petrol'], [/\bbpcl\b|bharat petroleum/i, 'Bharat Petroleum'],
];

const NOISE = /\b(upi|dr|cr|paid|pur|pos|neft|imps|rtgs|ach|nach|ecs|si|bil|onl|ib|mb|vps|vpa|txn|ref|payment|paymnt|pmt|autopay|auto ?debit|mandate|recurring|subscription|debit|card|purchase|ecom|international|intl|charges?|to|from|by|for|via|the|ltd|limited|pvt|private|india|in|com|www|online|services?|technologies|digital|media|entertainment|hdfc\w*|icic\w*|sbi\w*|axis\w*|kotak\w*|yes ?bank|paytm|phonepe|gpay|razorpay|cashfree|billdesk|payu|ccavenue)\b/gi;

// A merchant ATLER recognises by name (Netflix, Swiggy, …), or null.
export const knownMerchant = (description: string): string | null => KNOWN.find(([re]) => re.test(description))?.[1] ?? null;

export function merchantName(description: string): string | null {
  const known = knownMerchant(description);
  if (known) return known;
  const words = description
    .replace(/[\w.]+@[A-Za-z.]+/g, ' ')         // UPI handles / emails
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, ' ')  // IFSC codes
    .replace(/[^A-Za-z\s]/g, ' ')              // digits, reference numbers, punctuation
    .replace(NOISE, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
  if (!words.length) return null;
  return words.slice(0, 2).map(w => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

