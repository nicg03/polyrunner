export interface PreauthResult {
  paymentRef: string;
  status: "preauthorized";
}

export interface PaymentProvider {
  id: "mock" | "stripe";
  /** Hold amount without charging. */
  preauthorize(userId: string, amountEur: number, meta: Record<string, unknown>): Promise<PreauthResult>;
  /** Cancel hold when goal met. */
  voidPreauth(paymentRef: string): Promise<void>;
  /** Charge held amount and mark as donated to charity (platform never keeps it). */
  chargeAndDonate(paymentRef: string, charityName: string): Promise<{ donatedEur: number }>;
}
