// Turns a pasted bank debit SMS into an expense: amount, date, merchant and a
// suggested category. Runs on the device; nothing is sent anywhere.
import { getLocalDateKey } from './dates.js';
import { merchantName, parseStatementDate } from './statement.js';

const AMOUNT = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const DEBIT = /\b(debited|spent|sent|paid|withdrawn|debit(?:ed)?|purchase|txn of)\b/i;
const DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[\s-][A-Za-z]{3}[A-Za-z]*[\s-,]+\d{2,4})\b/;

// Where banks put the payee, most specific first.
const PAYEE = [
    /\bto\s+vpa\s+([\w.-]+@[\w.-]+)/i,                      // SBI: to VPA swiggy@icici
    /\bupi\/p2[am]\/\d+\/([^/.;\n]+?)(?:\s+credited\b|[.;]|$)/i, // ICICI/Axis: UPI/P2M/123/SWIGGY
    /\binfo:?\s*([^.\n]+?)(?:\.|\s+avl|\s+bal|$)/i,          // Info: ACH*NETFLIX
    /\bat\s+([A-Za-z0-9 &*._-]+?)\s+on\b/i,                  // card: spent ... at AIRTEL on
    /\bto\s+([A-Za-z0-9 &*._@-]+?)\s+on\b/i,                 // HDFC: To SWIGGY On 01/10/26
    /\btowards\s+([A-Za-z0-9 &*._-]+?)(?:\s+on\b|\.|,|$)/i,  // towards NETFLIX
    /\bto\s+([A-Za-z0-9 &*._@-]+?)(?:\.|,|\s+ref\b|\s+upi\b|$)/i,
];

const CATEGORY_HINTS = [
    [/swiggy|zomato|blinkit|zepto|instamart|bigbasket|dunzo|domino|mcdonald|kfc|starbucks|restaurant|cafe|eatclub/i, 'Food'],
    [/uber|ola|rapido|irctc|redbus|metro|fastag|petrol|fuel|indian ?oil|hpcl|bpcl|makemytrip|indigo/i, 'Transport'],
    [/netflix|spotify|hotstar|prime ?video|youtube|sonyliv|zee5|bookmyshow|pvr|inox|steam|playstation/i, 'Entertainment'],
    [/airtel|jio|vodafone|\bvi\b|bsnl|electricity|bescom|tneb|tata ?power|broadband|fibernet|gas|water bill/i, 'Utilities'],
    [/amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|croma|reliance digital/i, 'Shopping'],
    [/apollo|pharmeasy|1mg|netmeds|medplus|hospital|clinic|cult\.?fit|gym/i, 'Health'],
    [/coursera|udemy|byju|unacademy|college|university|exam fee|books?/i, 'Education'],
    [/notion|github|openai|chatgpt|google one|microsoft|adobe|canva|figma/i, 'Productivity'],
];

export function suggestCategory(text) {
    return CATEGORY_HINTS.find(([re]) => re.test(text))?.[1] ?? null;
}

// One SMS -> { amount, date, name, category } or null if it isn't a debit.
export function parseBankSms(text, today = new Date()) {
    const sms = String(text || '').replace(/\s+/g, ' ').trim();
    const amountMatch = sms.match(AMOUNT);
    if (!amountMatch) return null;
    // Money out only. ("debited ... RAPIDO credited" is still a debit: the
    // payee was credited.)
    if (!DEBIT.test(sms)) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!(amount > 0)) return null;

    const dateText = sms.match(DATE)?.[1];
    const date = (dateText && parseStatementDate(dateText.replace(/\s+/g, '-'))) || today;

    let payee = null;
    for (const re of PAYEE) {
        const m = sms.match(re);
        if (m) {
            payee = m[1].replace(/@.*/, ' ').trim(); // keep the handle's name part
            if (payee) break;
        }
    }
    const name = (payee && merchantName(payee)) || (payee && payee.length <= 40 ? payee : null) || 'Bank payment';
    return {
        amount,
        date: getLocalDateKey(date),
        name,
        category: suggestCategory(`${payee || ''} ${sms}`),
    };
}

// Several pasted messages, one per line (or separated by blank lines).
export function parseBankSmsList(text, today = new Date()) {
    return String(text || '')
        .split(/\n+/)
        .map(line => parseBankSms(line, today))
        .filter(Boolean);
}
