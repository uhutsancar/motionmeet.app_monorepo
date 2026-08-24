import Toast, { type ToastShowParams } from 'react-native-toast-message';

interface FeedbackError {
  name?: string;
  message?: string;
  code?: string;
  userCode?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      code?: string;
      requestId?: string;
      error?: { code?: string };
    };
  };
}

const errorDetails = (error: unknown): FeedbackError =>
  error && typeof error === 'object' ? error as FeedbackError : {};

const DEFAULT_MESSAGES = {
  NETWORK_ERROR: 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
  UNAUTHORIZED: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  PAYLOAD_TOO_LARGE: 'Seçtiğiniz dosya izin verilen boyuttan daha büyük.',
  UNSUPPORTED_MEDIA_TYPE: 'Bu dosya biçimi desteklenmiyor veya dosya bozuk.',
  RATE_LIMITED: 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.',
  SERVICE_UNAVAILABLE: 'Bu hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
};

export const getErrorCode = (error: unknown): string | null => {
  const details = errorDetails(error);
  if (
    !details.response &&
    (details.code === 'ERR_NETWORK' || /network error/i.test(details.message || ''))
  ) return 'NETWORK_ERROR';
  if (/uploaded media content is invalid|unsupported media/i.test(details.message || '')) {
    return 'UNSUPPORTED_MEDIA_TYPE';
  }
  return (
    details.userCode ||
    details.response?.data?.error?.code ||
    details.response?.data?.code ||
    details.code ||
    null
  );
};

export const getUserFacingError = (error: unknown, fallback?: string, messages: Record<string, string> = {}): string => {
  const details = errorDetails(error);
  const code = getErrorCode(error);
  const messageMap: Record<string, string> = { ...DEFAULT_MESSAGES, ...messages };
  if (code && messageMap[code]) return messageMap[code];

  const responseMessage = details.response?.data?.message;
  if (
    typeof responseMessage === 'string' &&
    responseMessage.length > 0 &&
    responseMessage.length <= 180 &&
    !responseMessage.trim().startsWith('{')
  ) {
    return responseMessage;
  }

  if (
    typeof details.message === 'string' &&
    details.message.length > 0 &&
    details.message.length <= 180 &&
    !details.message.trim().startsWith('{')
  ) {
    return details.message;
  }
  return fallback || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
};

type FeedbackOptions = Omit<ToastShowParams, 'type' | 'text1' | 'text2'>;

/**
 * How long a toast is left alone before another may replace it.
 *
 * The library shows one at a time, so two results landing together — "shared"
 * immediately followed by "saved" — cut each other off mid-animation and read
 * as one flickering box. This is the pause that lets the first one be read.
 */
const TOAST_SPACING_MS = 900;

let lastShownAt = 0;
let queuedTimer: ReturnType<typeof setTimeout> | undefined;

const present = (params: ToastShowParams): void => {
  lastShownAt = Date.now();
  Toast.show(params);
};

/**
 * Shows a toast, holding it back if one has only just appeared.
 *
 * Only the most recent pending toast is kept: when three things finish at once
 * the member wants the outcome, not a queue of three boxes to sit through.
 */
const show = (type: 'success' | 'error' | 'info', title: string, message: string, options: FeedbackOptions = {}): void => {
  const params: ToastShowParams = {
    type,
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: options.visibilityTime || (type === 'error' ? 4600 : 3200),
    ...options,
  };

  const since = Date.now() - lastShownAt;
  if (since >= TOAST_SPACING_MS) {
    if (queuedTimer) clearTimeout(queuedTimer);
    queuedTimer = undefined;
    present(params);
    return;
  }

  if (queuedTimer) clearTimeout(queuedTimer);
  queuedTimer = setTimeout(() => {
    queuedTimer = undefined;
    present(params);
  }, TOAST_SPACING_MS - since);
};

export const showSuccess = (title: string, message: string, options?: FeedbackOptions): void =>
  show('success', title, message, options);

export const showError = (title: string, message: string, options?: FeedbackOptions): void =>
  show('error', title, message, options);

export const showInfo = (title: string, message: string, options?: FeedbackOptions): void =>
  show('info', title, message, options);

export const logHandledError = (scope: string, error: unknown): void => {
  if (!__DEV__) return;
  const details = errorDetails(error);
  console.log(`[Handled:${scope}]`, {
    name: details.name,
    // Without the message a network failure logs as an empty Error and there is
    // nothing left to diagnose from.
    message: details.message,
    status: details.response?.status,
    code: getErrorCode(error),
    requestId: details.response?.data?.requestId,
  });
};
