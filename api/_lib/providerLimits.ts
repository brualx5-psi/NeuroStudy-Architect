import { buildLimitResponse } from './limitResponses.js';

const isProviderLimitError = (error: any) => {
  const text = [
    error?.message,
    error?.statusText,
    error?.error?.message,
    error?.cause?.message,
    typeof error === 'string' ? error : ''
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    error?.status === 429 ||
    error?.status === 503 ||
    text.includes('resource_exhausted') ||
    text.includes('quota') ||
    text.includes('credits') ||
    text.includes('credit') ||
    text.includes('billing') ||
    text.includes('429') ||
    text.includes('503')
  );
};

export const buildProviderLimitPayload = (error: any) => {
  if (!isProviderLimitError(error)) return null;

  return {
    status: 429,
    body: buildLimitResponse('provider_quota_exhausted')
  };
};
