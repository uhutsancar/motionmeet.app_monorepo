import { useState, useEffect } from 'react';
import { useAuthContext } from "../context/AuthProvider";
import api from '../api/axios';

let equipmentCache = null;

export const useEquipment = (options = {}) => {
  const { getToken } = useAuthContext();
  const [data, setData] = useState(equipmentCache || []);
  const [isLoading, setIsLoading] = useState(!equipmentCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (equipmentCache && !options.forceRefresh) {
      return;
    }

    let isMounted = true;
    const fetchEquipment = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        const data = await getEquipment(); const response = { data };
        
        if (response.data.success) {
          equipmentCache = response.data.data;
          if (isMounted) setData(equipmentCache);
        } else {
          throw new Error(response.data.error?.message || "Failed to fetch equipment");
        }
      } catch (err) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchEquipment();
    return () => { isMounted = false; };
  }, [getToken, options.forceRefresh]);

  return { data, isLoading, error };
};
