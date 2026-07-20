import { useState, useEffect } from 'react';
import { useAuthContext } from "../context/AuthProvider";
import api from '../api/axios';

let muscleGroupsCache = null;

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
        const data = await getMuscleGroups(); const response = { data };
        
        if (response.data.success) {
          muscleGroupsCache = response.data.data;
          if (isMounted) setData(muscleGroupsCache);
        } else {
          throw new Error(response.data.error?.message || "Failed to fetch muscle groups");
        }
      } catch (err) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMuscleGroups();
    return () => { isMounted = false; };
  }, [getToken, options.forceRefresh]);

  return { data, isLoading, error };
};
