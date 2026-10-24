import type Ionicons from '@expo/vector-icons/Ionicons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Icons that stand for one thing across the whole app.
 *
 * Direct messages were drawn three different ways — a chat bubble in the tab
 * bar, a paper plane on a post, an envelope on a profile — which made them read
 * as three different features. Anything that opens or sends a direct message
 * uses the pair below and nothing else.
 */
export const MESSAGE_ICON: IoniconName = 'paper-plane-outline';
