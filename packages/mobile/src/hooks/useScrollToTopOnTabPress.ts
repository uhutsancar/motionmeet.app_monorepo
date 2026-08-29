import { useEffect, type RefObject } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { FlatList, ScrollView } from 'react-native';

/** Anything with a scroll offset this hook knows how to reset. */
type Scrollable =
  | Pick<FlatList<unknown>, 'scrollToOffset'>
  | Pick<ScrollView, 'scrollTo'>;

interface TabNavigationLike {
  getParent: () => TabNavigationLike | undefined;
  getState: () => { type?: string } | undefined;
  addListener: (event: 'tabPress', callback: () => void) => () => void;
}

/**
 * Sends a tab's list back to the top when its icon is tapped.
 *
 * Pressing the tab you are already on is the gesture every app uses to get back
 * to the newest thing, and without it the only way back up a long feed was to
 * flick at the screen twenty times. React Navigation ships `useScrollToTop`,
 * but it only fires while the screen is focused — so a tab left halfway down
 * came back halfway down, which is the other half of the same complaint. This
 * listens for the press itself, so the screen is at the top whether it was the
 * one already open or one being returned to.
 *
 * The listener has to be attached to the navigation object that belongs to the
 * tab navigator — `getState()` on a screen's navigation returns the state of
 * the navigator that *contains* it, so the one to attach to is the first in the
 * chain whose own state is a tab state. A screen inside a nested stack (Profile
 * is one) never sees `tabPress` on its own navigation, so the hook walks up
 * until it finds that one.
 */
export const useScrollToTopOnTabPress = (ref: RefObject<Scrollable | null>): void => {
  const navigation = useNavigation() as unknown as TabNavigationLike;

  useEffect(() => {
    let target: TabNavigationLike | undefined = navigation;
    while (target && target.getState()?.type !== 'tab') {
      target = target.getParent();
    }
    if (!target) return;

    return target.addListener('tabPress', () => {
      // Next frame: the press may also be changing which tab is mounted, and a
      // list that is still being laid out ignores a scroll issued this frame.
      requestAnimationFrame(() => {
        const scrollable = ref.current;
        if (!scrollable) return;
        if ('scrollToOffset' in scrollable) scrollable.scrollToOffset({ offset: 0, animated: true });
        else if ('scrollTo' in scrollable) scrollable.scrollTo({ y: 0, animated: true });
      });
    });
  }, [navigation, ref]);
};
