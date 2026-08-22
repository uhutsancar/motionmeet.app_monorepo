import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Shared contract for the native and web implementations of the pager, so both
 * are typechecked against the same shape whichever one Metro resolves.
 */
export interface SwipeablePagerProps {
  /** Index of the visible pane. Controlled: the parent owns it. */
  page: number;
  /** Fired when a swipe lands on a different pane. */
  onPageChange: (page: number) => void;
  style?: StyleProp<ViewStyle>;
  /** One element per pane, each with a stable `key`. */
  children: ReactNode;
}
