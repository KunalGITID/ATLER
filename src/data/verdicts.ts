// Answering an unusual-spend alert. Kept on this phone (see core/alertFeedback.ts).
import { merchantOf, type Unusual } from '../core/insights.ts';
import type { AtlerDB } from './db.ts';

export async function answerAlert(db: AtlerDB, u: Unusual, expected: boolean) {
  await db.verdicts.put({ paymentId: u.payment.id, merchant: merchantOf(u.payment), times: u.times, expected, at: Date.now() });
}

export const unanswer = (db: AtlerDB, paymentId: string) => db.verdicts.delete(paymentId);
