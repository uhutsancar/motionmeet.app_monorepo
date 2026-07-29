import { useState, useEffect } from 'react';
import { useAuthContext } from "../context/AuthProvider";
import api from '../api/client';
import { API_ROUTES } from '@motionmeet/shared';

let equipmentCache = null;
let equipmentRequest = null;

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
        if (!equipmentRequest || options.forceRefresh) {
          equipmentRequest = api.get(API_ROUTES.metadata.equipment, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        const response = await equipmentRequest;
        
        if (response.data.success) {
          equipmentCache = response.data.data;
          if (isMounted) setData(equipmentCache);
        } else {
          throw new Error(response.data.error?.message || "Failed to fetch equipment");
        }
      } catch (err) {
        if (isMounted) setError(err);
      } finally {
        equipmentRequest = null;
        if (isMounted) setIsLoading(false);
      }
    };

    fetchEquipment();
    return () => { isMounted = false; };
  }, [getToken, options.forceRefresh]);

  return { data, isLoading, error };
};
