import { useState, useEffect } from 'react';
import { useAuthContext } from "../context/AuthProvider";
import api from '../api/client';
import { API_ROUTES } from '@motionmeet/shared';

let muscleGroupsCache = null;
let muscleGroupsRequest = null;

export const useMuscleGroups = (options = {}) => {
  const { getToken } = useAuthContext();
  const [data, setData] = useState(muscleGroupsCache || []);
  const [isLoading, setIsLoading] = useState(!muscleGroupsCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (muscleGroupsCache && !options.forceRefresh) {
      return;
    }

    let isMounted = true;
    const fetchMuscleGroups = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!muscleGroupsRequest || options.forceRefresh) {
          muscleGroupsRequest = api.get(API_ROUTES.metadata.muscleGroups, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        const response = await muscleGroupsRequest;
        
        if (response.data.success) {
          muscleGroupsCache = response.data.data;
          if (isMounted) setData(muscleGroupsCache);
        } else {
          throw new Error(response.data.error?.message || "Failed to fetch muscle groups");
        }
      } catch (err) {
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
