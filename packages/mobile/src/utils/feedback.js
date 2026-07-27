import Toast from 'react-native-toast-message';

const DEFAULT_MESSAGES = {
  NETWORK_ERROR: 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
  UNAUTHORIZED: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  PAYLOAD_TOO_LARGE: 'Seçtiğiniz dosya izin verilen boyuttan daha büyük.',
  UNSUPPORTED_MEDIA_TYPE: 'Bu dosya biçimi desteklenmiyor veya dosya bozuk.',
  RATE_LIMITED: 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.',
  SERVICE_UNAVAILABLE: 'Bu hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
};

export const getErrorCode = (error) => {
  if (
    !error?.response &&
    (error?.code === 'ERR_NETWORK' || /network error/i.test(error?.message || ''))
  ) return 'NETWORK_ERROR';
  if (/uploaded media content is invalid|unsupported media/i.test(error?.message || '')) {
    return 'UNSUPPORTED_MEDIA_TYPE';
  }
  return (
    error?.userCode ||
    error?.response?.data?.error?.code ||
    error?.response?.data?.code ||
    error?.code ||
    null
  );
};

export const getUserFacingError = (error, fallback, messages = {}) => {
  const code = getErrorCode(error);
  const messageMap = { ...DEFAULT_MESSAGES, ...messages };
  if (code && messageMap[code]) return messageMap[code];

  const responseMessage = error?.response?.data?.message;
  if (
    typeof responseMessage === 'string' &&
    responseMessage.length > 0 &&
    responseMessage.length <= 180 &&
    !responseMessage.trim().startsWith('{')
  ) {
    return responseMessage;
  }

  if (
    typeof error?.message === 'string' &&
    error.message.length > 0 &&
    error.message.length <= 180 &&
    !error.message.trim().startsWith('{')
  ) {
    return error.message;
  }
  return fallback || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
};

const show = (type, title, message, options = {}) => {
  Toast.show({
    type,
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: options.visibilityTime || (type === 'error' ? 4600 : 3200),
    ...options,
  });
};

export const showSuccess = (title, message, options) =>
  show('success', title, message, options);

export const showError = (title, message, options) =>
  show('error', title, message, options);

export const showInfo = (title, message, options) =>
  show('info', title, message, options);

export const logHandledError = (scope, error) => {
  if (!__DEV__) return;
  console.log(`[Handled:${scope}]`, {
    status: error?.response?.status,
    code: getErrorCode(error),
    requestId: error?.response?.data?.requestId,
    message: error?.message,
  });
};
