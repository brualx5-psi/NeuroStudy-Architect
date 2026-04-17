import { buildLimitResponse } from './limitResponses.js';
import { LimitReason } from './usageLimits.js';

const getErrorText = (error: any) => {
  const parts = [
    error?.message,
    error?.statusText,
    error?.error?.message,
    error?.details,
  ].filter(Boolean);

  return parts.join(' ').toLowerCase();
};

export const classifyProviderLimitReason = (error: any): LimitReason | null => {
  const status = Number(error?.status || error?.code || 0);
  const text = getErrorText(error);

  const quotaSignals = [
    'resource_exhausted',
    'quota',
    'credits',
    'credit',
    'insufficient balance',
    'billing',
    'exceeded your current quota',
    'usage limit',
  ];

  if (quotaSignals.some((signal) => text.includes(signal))) {
    return 'provider_quota_exhausted';
  }

  const rateSignals = [
    'rate limit',
    'too many requests',
    'rate_limited',
  ];

  if (status === 429 || status === 503 || text.includes('429')) {
    if (rateSignals.some((signal) => text.includes(signal))) {
      return 'rate_limited';
    }
    return 'provider_quota_exhausted';
  }

  return null;
};

export const buildProviderLimitPayload = (error: any) => {
  const reason = classifyProviderLimitReason(error);
  if (!reason) return null;

  return {
    status: 429,
    body: buildLimitResponse(reason),
  };
};
