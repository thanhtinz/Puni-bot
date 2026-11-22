import { getSiteSetting } from "@/lib/db";

/** Owner-configured receiving bank account (Admin → Membership).
 *  Stored as site settings pay_bank_bin / pay_account_no /
 *  pay_account_name. All three are required for online sales. */
export interface PaymentSettings {
  bankBin: string;
  accountNo: string;
  accountName: string;
}

export async function getPaymentSettings(): Promise<PaymentSettings | null> {
  const [bankBin, accountNo, accountName] = await Promise.all([
    getSiteSetting("pay_bank_bin").catch(() => null),
    getSiteSetting("pay_account_no").catch(() => null),
    getSiteSetting("pay_account_name").catch(() => null),
  ]);
  if (!bankBin || !accountNo || !accountName) return null;
  return { bankBin, accountNo, accountName };
}

/** VietQR image URL carrying amount + order code as transfer content. */
export function vietQrUrl(pay: PaymentSettings, amount: number, code: string): string {
  const base = `https://img.vietqr.io/image/${encodeURIComponent(pay.bankBin)}-${encodeURIComponent(pay.accountNo)}-compact2.png`;
  const qs = new URLSearchParams({
    amount: String(amount),
    addInfo: code,
    accountName: pay.accountName,
  });
  return `${base}?${qs.toString()}`;
}
