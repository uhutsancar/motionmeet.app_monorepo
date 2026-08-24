import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import i18n from '../i18n';

/**
 * What came back from asking for a permission.
 *
 * `denied` and `blocked` are deliberately separate. "Denied" is a no that the
 * OS will let us put again — usually a mis-tap — so the feature stays live and
 * simply asks the next time it is used. "Blocked" is a no the OS will not
 * re-prompt for, and the only way through is the system settings screen, so
 * that is the one case where we offer to open it.
 */
export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

export interface PermissionRequest {
  outcome: PermissionOutcome;
  granted: boolean;
}

interface ExpoPermissionResponse {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

const toOutcome = (response: ExpoPermissionResponse): PermissionRequest => {
  if (response.granted) return { outcome: 'granted', granted: true };
  return { outcome: response.canAskAgain ? 'denied' : 'blocked', granted: false };
};

/**
 * Offers to take the member to the OS settings for this app.
 *
 * Only worth showing once the system has stopped prompting on its own —
 * otherwise the app is sending someone to a settings screen for a question it
 * could simply ask again.
 */
export const promptForSettings = (message: string, title?: string): void => {
  const t = i18n.t.bind(i18n);
  Alert.alert(title ?? t('permissions.title', 'İzin gerekli'), message, [
    { text: t('common.cancel', 'Vazgeç'), style: 'cancel' },
    {
      text:
        Platform.OS === 'ios'
          ? t('permissions.open_settings', 'Ayarları aç')
          : t('permissions.open_settings', 'Ayarları aç'),
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
};

/**
 * Asks for the photo library, and explains the way out if the answer is a
 * permanent no.
 *
 * A refusal never disables the feature: the next time the member taps the
 * button, this runs again and the OS asks again. That is the whole point —
 * saying "no" once to a dialog that appeared at an awkward moment should not
 * cost someone the ability to post a photo forever.
 */
export const ensureMediaLibraryPermission = async (
  options: { explain?: boolean } = {},
): Promise<PermissionRequest> => {
  const t = i18n.t.bind(i18n);
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return { outcome: 'granted', granted: true };

  // `canAskAgain` false means the OS will return the same answer without ever
  // showing a dialog, so asking again would look like the button is broken.
  const response = current.canAskAgain
    ? await ImagePicker.requestMediaLibraryPermissionsAsync()
    : current;
  const result = toOutcome(response);

  if (result.outcome === 'blocked' && options.explain !== false) {
    promptForSettings(
      t(
        'permissions.media_blocked',
        'Fotoğraflarına erişim kapalı. Paylaşım yapabilmek için ayarlardan galeri iznini açman gerekiyor.',
      ),
    );
  }

  return result;
};

/** The same contract as the library permission, for the camera. */
export const ensureCameraPermission = async (
  options: { explain?: boolean } = {},
): Promise<PermissionRequest> => {
  const t = i18n.t.bind(i18n);
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return { outcome: 'granted', granted: true };

  const response = current.canAskAgain ? await ImagePicker.requestCameraPermissionsAsync() : current;
  const result = toOutcome(response);

  if (result.outcome === 'blocked' && options.explain !== false) {
    promptForSettings(
      t(
        'permissions.camera_blocked',
        'Kameraya erişim kapalı. Fotoğraf çekebilmek için ayarlardan kamera iznini açman gerekiyor.',
      ),
    );
  }

  return result;
};
