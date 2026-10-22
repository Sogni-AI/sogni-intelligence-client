export const VENDOR_MODEL_PREMIUM_REQUIRED_ERROR = 'vendor_model_premium_required';

export const VENDOR_MODEL_PREMIUM_REQUIRED_MESSAGE =
  'Third-party vendor models (GPT Image 2, Seedance, Seedream, HappyHorse, and Wan 3) require Premium Spark Points on this account. Buy Premium Spark with a card or choose a Sogni-native model.';

export interface VendorModelPremiumRequiredPayload {
  error: typeof VENDOR_MODEL_PREMIUM_REQUIRED_ERROR;
  message: typeof VENDOR_MODEL_PREMIUM_REQUIRED_MESSAGE;
  retryPolicy: 'manual_user_confirmation';
  nextAction: 'wait_for_user';
  technicalError?: string;
}

export interface PremiumSparkBalanceLike {
  premiumCredit?: string | number | null;
}

export interface PremiumSparkBalancesLike {
  spark?: PremiumSparkBalanceLike | null;
}

export function vendorModelPremiumRequiredPayload(
  technicalError?: string,
): VendorModelPremiumRequiredPayload {
  return {
    error: VENDOR_MODEL_PREMIUM_REQUIRED_ERROR,
    message: VENDOR_MODEL_PREMIUM_REQUIRED_MESSAGE,
    retryPolicy: 'manual_user_confirmation',
    nextAction: 'wait_for_user',
    ...(technicalError ? { technicalError: technicalError.slice(0, 500) } : {}),
  };
}

export function accountHasPremiumSparkAccess(
  balances: PremiumSparkBalancesLike | null | undefined,
): boolean | null {
  const premiumCredit = balances?.spark?.premiumCredit;
  if (premiumCredit === undefined || premiumCredit === null) return null;

  const parsed = typeof premiumCredit === 'number'
    ? premiumCredit
    : Number.parseFloat(premiumCredit);
  if (!Number.isFinite(parsed)) return null;

  return parsed > 0;
}

export function collectErrorText(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    const cause = (value as { cause?: unknown }).cause;
    return [
      value.name,
      value.message,
      cause ? collectErrorText(cause, seen) : '',
    ].filter(Boolean).join(' ');
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '';
  seen.add(value);

  const record = value as Record<string, unknown>;
  const nested = Object.values(record)
    .map((nestedValue) => collectErrorText(nestedValue, seen))
    .filter(Boolean)
    .join(' ');

  try {
    return `${JSON.stringify(value)} ${nested}`.trim();
  } catch {
    return nested;
  }
}

export function textRequiresVendorModelPremiumSpark(text: string): boolean {
  const lowerText = text.toLowerCase();
  const mentionsPremiumSpark =
    lowerText.includes('premium spark') ||
    lowerText.includes('premium spark points');
  if (!mentionsPremiumSpark) return false;

  const mentionsVendorModel =
    lowerText.includes('gpt image') ||
    lowerText.includes('gpt-image') ||
    lowerText.includes('seedance') ||
    lowerText.includes('seedream') ||
    lowerText.includes('happyhorse') ||
    lowerText.includes('wan3') ||
    lowerText.includes('happy horse') ||
    lowerText.includes('third-party vendor model') ||
    lowerText.includes('third party vendor model') ||
    lowerText.includes('vendor model');

  return (
    lowerText.includes('requires payment') ||
    lowerText.includes('payment required') ||
    lowerText.includes('requires premium spark') ||
    lowerText.includes('require premium spark') ||
    lowerText.includes('premium spark required') ||
    lowerText.includes(VENDOR_MODEL_PREMIUM_REQUIRED_ERROR)
  ) && mentionsVendorModel;
}

export function vendorModelPremiumPayloadFromError(
  error: unknown,
): VendorModelPremiumRequiredPayload | null {
  const text = collectErrorText(error);
  if (!textRequiresVendorModelPremiumSpark(text)) return null;

  return vendorModelPremiumRequiredPayload(text);
}
