import React, { useMemo } from 'react';
import { BaseToast, ErrorToast } from 'react-native-toast-message';
import Toast from 'react-native-toast-message';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const AppToast = () => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const usableWidth = Math.max(0, width - insets.left - insets.right);
  const toastWidth = Math.max(1, Math.min(usableWidth - 24, 560));

  const config = useMemo(() => {
    const sharedProps = {
      style: {
        width: toastWidth,
        minHeight: 64,
        borderRadius: 14,
        backgroundColor: theme.surface,
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: theme.border,
      },
      contentContainerStyle: { paddingHorizontal: 14 },
      text1Style: { color: theme.text, fontSize: 14, fontWeight: '800' },
      text2Style: { color: theme.textSecondary, fontSize: 12, lineHeight: 17 },
      text2NumberOfLines: 3,
    };

    return {
      success: (props) => (
        <BaseToast
          {...props}
          {...sharedProps}
          style={[sharedProps.style, { borderLeftColor: '#22A06B', borderLeftWidth: 5 }]}
        />
      ),
      info: (props) => (
        <BaseToast
          {...props}
          {...sharedProps}
          style={[sharedProps.style, { borderLeftColor: theme.primary, borderLeftWidth: 5 }]}
        />
      ),
      error: (props) => (
        <ErrorToast
          {...props}
          {...sharedProps}
          style={[sharedProps.style, { borderLeftColor: theme.danger, borderLeftWidth: 5 }]}
        />
      ),
    };
  }, [
    theme.border,
    theme.danger,
    theme.primary,
    theme.surface,
    theme.text,
    theme.textSecondary,
    toastWidth,
  ]);

  return (
    <Toast
      config={config}
      position="top"
      topOffset={insets.top + 10}
      bottomOffset={insets.bottom + 10}
      visibilityTime={3800}
    />
  );
};

export default AppToast;
