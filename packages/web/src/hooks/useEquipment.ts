import { useState, useEffect } from 'react';
import { useAuthContext } from "../context/AuthProvider";
import api from '../api/axios';
import { API_ROUTES } from '@motionmeet/shared';
import type { AxiosResponse } from "axios";
import type { MetadataItem } from "./useMuscleGroups";

interface MetadataResponse { success: boolean; data: MetadataItem[]; error?: { message?: string } }
interface MetadataOptions { forceRefresh?: boolean }
let equipmentCache: MetadataItem[] | null = null;
let equipmentRequest: Promise<AxiosResponse<MetadataResponse>> | null = null;

export const useEquipment = (options: MetadataOptions = {}) => {
  const { getToken } = useAuthContext();
  const [data, setData] = useState<MetadataItem[]>(equipmentCache || []);
  const [isLoading, setIsLoading] = useState(!equipmentCache);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (equipmentCache && !options.forceRefresh) {
      return;
    }

    let isMounted = true;
    const fetchEquipment = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("Authentication required");
        if (!equipmentRequest || options.forceRefresh) {
          equipmentRequest = api.get<MetadataResponse>(API_ROUTES.metadata.equipment, {
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
