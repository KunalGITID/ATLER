// A pasted bank debit SMS -> an expense (amount, date, payee, suggested
// category). Runs on the phone; nothing is sent anywhere.
import type { Day } from '../dates.ts';
import { paise, type Paise } from '../money.ts';
import { merchantName, moneyCell, parseStatementDate } from './statement.ts';

const AMOUNT = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
const DEBIT = /\b(debited|spent|sent|paid|withdrawn|debit(?:ed)?|purchase|txn of)\b/i;
const DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[\s-][A-Za-z]{3}[A-Za-z]*[\s,-]+\d{2,4})\b/;

// Where banks put the payee, most specific first.
const PAYEE = [
  /\bto\s+vpa\s+([\w.-]+@[\w.-]+)/i,                                // SBI: to VPA swiggy@icici
  /\bupi\/p2[am]\/\d+\/([^/.;\n]+?)(?:\s+credited\b|[.;]|$)/i,      // ICICI/Axis: UPI/P2M/123/SWIGGY
  /\binfo:?\s*([^.\n]+?)(?:\.|\s+avl|\s+bal|$)/i,                   // Info: ACH*NETFLIX
  /\bat\s+([A-Za-z0-9 &*._-]+?)\s+on\b/i,                          // card: spent ... at AIRTEL on
  /\bto\s+([A-Za-z0-9 &*._@-]+?)\s+on\b/i,                          // HDFC: To SWIGGY On 01/10/26
  /\btowards\s+([A-Za-z0-9 &*._-]+?)(?:\s+on\b|\.|,|$)/i,           // towards NETFLIX
  /\bto\s+([A-Za-z0-9 &*._@-]+?)(?:\.|,|\s+ref\b|\s+upi\b|$)/i,
];

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/swiggy|zomato|blinkit|zepto|instamart|bigbasket|dunzo|domino|mcdonald|kfc|starbucks|restaurant|cafe|eatclub/i, 'Food'],
  [/uber|ola|rapido|irctc|redbus|metro|fastag|petrol|fuel|indian ?oil|hpcl|bpcl|makemytrip|indigo/i, 'Transport'],
  [/netflix|spotify|hotstar|prime ?video|youtube|sonyliv|zee5|bookmyshow|pvr|inox|steam|playstation/i, 'Entertainment'],
  [/airtel|jio|vodafone|\bvi\b|bsnl|electricity|bescom|tneb|tata ?power|broadband|fibernet|gas|water bill/i, 'Utilities'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|croma|reliance digital/i, 'Shopping'],
  [/apollo|pharmeasy|1mg|netmeds|medplus|hospital|clinic|cult\.?fit|gym/i, 'Health'],
  [/coursera|udemy|byju|unacademy|college|university|exam fee|books?/i, 'Education'],
  [/notion|github|openai|chatgpt|google one|microsoft|adobe|canva|figma/i, 'Productivity'],
];

export const suggestCategory = (text: string): string | null => CATEGORY_HINTS.find(([re]) => re.test(text))?.[1] ?? null;

export interface SmsExpense { amount: Paise; on: Day; name: string; category: string | null }

export function parseBankSms(text: string, today: Day): SmsExpense | null {
  const sms = String(text ?? '').replace(/\s+/g, ' ').trim();
  const amountText = sms.match(AMOUNT)?.[1];
  // Money out only ("debited ... RAPIDO credited" is still a debit: the payee was credited).
  if (!amountText || !DEBIT.test(sms)) return null;
  const amount = moneyCell(amountText);
  if (amount === null || amount <= 0) return null;

  const dateText = sms.match(DATE)?.[1];
  const on = (dateText && parseStatementDate(dateText.replace(/\s+/g, '-'))) || today;

  let payee: string | null = null;
  for (const re of PAYEE) {
    const m = sms.match(re);
    if (m?.[1]) {
      payee = m[1].replace(/@.*/, ' ').trim(); // keep a UPI handle's name part
      if (payee) break;
    }
  }
  const name = (payee && merchantName(payee)) || (payee && payee.length <= 40 ? payee : null) || 'Bank payment';
  return { amount: paise(amount), on, name, category: suggestCategory(`${payee ?? ''} ${sms}`) };
}

// Several pasted messages, one per line.
export const parseBankSmsList = (text: string, today: Day) =>
  String(text ?? '').split(/\n+/).map(line => parseBankSms(line, today)).filter((x): x is SmsExpense => x !== null);
