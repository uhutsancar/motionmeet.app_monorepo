import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSelector } from '../../store/hooks';
import { loadActiveWorkoutDraft, type ActiveWorkoutDraft } from './activeWorkoutDraft';

/**
 * The signed-in member's unfinished workout, re-read whenever the calling
 * screen comes into focus, so a "back to your workout" entry appears as soon
 * as the workout screen is minimised and disappears once it is saved.
 */
export const useActiveWorkoutDraft = (): ActiveWorkoutDraft | null => {
  const ownerId = useAppSelector((state) => state.user.value?._id ?? null);
  const [draft, setDraft] = useState<ActiveWorkoutDraft | null>(null);

  useFocusEffect(useCallback(() => {
    if (!ownerId) {
      setDraft(null);
      return undefined;
    }
    let active = true;
    loadActiveWorkoutDraft(ownerId)
      .then((stored) => { if (active) setDraft(stored); })
      .catch(() => { if (active) setDraft(null); });
    return () => { active = false; };
  }, [ownerId]));

  return draft;
};
