import { useState, useEffect } from 'react';
import { useAuthContext } from "../context/AuthProvider";
import api from '../api/client';
import { API_ROUTES } from '@motionmeet/shared';
import type { AxiosResponse } from 'axios';
import type { MetadataOption } from './useMuscleGroups';

interface MetadataResponse {
  success: boolean;
  data: MetadataOption[];
  error?: { message?: string };
}

interface MetadataOptions { forceRefresh?: boolean }

let equipmentCache: MetadataOption[] | null = null;
let equipmentRequest: Promise<AxiosResponse<MetadataResponse>> | null = null;

export const useEquipment = (options: MetadataOptions = {}) => {
  const { getToken } = useAuthContext();
  const [data, setData] = useState(equipmentCache || []);
  const [isLoading, setIsLoading] = useState(!equipmentCache);
  const [error, setError] = useState<unknown>(null);
  // Bumped to load again after a failure. The lists are the same for everyone
  // and change rarely, but a screen opened while offline must not keep empty
  // filters and an unlabelled radar until the app is restarted.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (equipmentCache && !options.forceRefresh) {
      // Another screen may have filled the cache while this one was retrying.
      const cached = equipmentCache;
      setData((current) => (current.length ? current : cached));
      return;
    }

    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const fetchEquipment = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        if (!equipmentRequest || options.forceRefresh) {
          equipmentRequest = api.get(API_ROUTES.metadata.equipment, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        const response = await equipmentRequest;
        
        if (response.data.success) {
          equipmentCache = response.data.data;
          if (isMounted) setData(equipmentCache ?? []);
        } else {
          throw new Error(response.data.error?.message || "Failed to fetch equipment");
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err);
          if (attempt < 3) retryTimer = setTimeout(() => setAttempt((value) => value + 1), 3000 * (attempt + 1));
        }
      } finally {
        equipmentRequest = null;
        if (isMounted) setIsLoading(false);
      }
    };

    fetchEquipment();
    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [attempt, getToken, options.forceRefresh]);

  return { data, isLoading, error };
};
