import { useState, useEffect } from 'react';
import { useAuthContext } from "../context/AuthProvider";
import api from '../api/client';
import { API_ROUTES } from '@motionmeet/shared';
import type { AxiosResponse } from 'axios';

export interface MetadataOption {
  id: string;
  _id: string;
  code: string;
  name: string;
  isActive: boolean;
  order: number;
}

interface MetadataResponse {
  success: boolean;
  data: MetadataOption[];
  error?: { message?: string };
}

interface MetadataOptions { forceRefresh?: boolean }

let muscleGroupsCache: MetadataOption[] | null = null;
let muscleGroupsRequest: Promise<AxiosResponse<MetadataResponse>> | null = null;

export const useMuscleGroups = (options: MetadataOptions = {}) => {
  const { getToken } = useAuthContext();
  const [data, setData] = useState(muscleGroupsCache || []);
  const [isLoading, setIsLoading] = useState(!muscleGroupsCache);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (muscleGroupsCache && !options.forceRefresh) {
      return;
    }

    let isMounted = true;
    const fetchMuscleGroups = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error('Authentication required');
        if (!muscleGroupsRequest || options.forceRefresh) {
          muscleGroupsRequest = api.get(API_ROUTES.metadata.muscleGroups, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        const response = await muscleGroupsRequest;
        
        if (response.data.success) {
          muscleGroupsCache = response.data.data;
          if (isMounted) setData(muscleGroupsCache ?? []);
        } else {
          throw new Error(response.data.error?.message || "Failed to fetch muscle groups");
        }
      } catch (err: unknown) {
        if (isMounted) setError(err);
      } finally {
        muscleGroupsRequest = null;
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMuscleGroups();
    return () => { isMounted = false; };
  }, [getToken, options.forceRefresh]);

  return { data, isLoading, error };
};
