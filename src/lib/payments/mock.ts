import type { PaymentProvider } from "./types";

const holds = new Map<string, { userId: string; amountEur: number; status: string; charity?: string }>();

export const mockPaymentProvider: PaymentProvider = {
  id: "mock",
  async preauthorize(userId, amountEur) {
    const paymentRef = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    holds.set(paymentRef, { userId, amountEur, status: "preauthorized" });
    return { paymentRef, status: "preauthorized" };
  },
  async voidPreauth(paymentRef) {
    const h = holds.get(paymentRef);
    if (h) h.status = "voided";
  },
  async chargeAndDonate(paymentRef, charityName) {
    const h = holds.get(paymentRef);
    if (!h) throw new Error("Preautorizzazione non trovata");
    h.status = "donated";
    h.charity = charityName;
    return { donatedEur: h.amountEur };
  },
};

export function getPaymentProvider(): PaymentProvider {
  return mockPaymentProvider;
}
