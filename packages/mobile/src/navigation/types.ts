import type { Exercise, Workout, WorkoutStats } from '@motionmeet/shared';
import type { NavigationProp, ParamListBase, RouteProp } from '@react-navigation/native';

export interface NavigationLike {
  goBack: () => void;
  navigate: (screen: string, params?: object) => void;
}

export interface RouteLike<Params extends object> {
  params: Params;
}

export interface NavigationScreenProps<Params extends object = Record<string, never>> {
  navigation: NavigationLike;
  route: RouteLike<Params>;
}

export interface NavigationOnlyProps {
  navigation: NavigationLike;
}

export interface BaseNavigationScreenProps {
  navigation: NavigationProp<ParamListBase>;
  route: RouteProp<ParamListBase>;
}

export interface WorkoutStatsRouteParams {
  statsData?: WorkoutStats | null;
}

export interface ExerciseDetailRouteParams {
  exercise: Exercise;
}

export interface WorkoutDetailRouteParams {
  workout?: Workout | null;
}
