import {apiClient} from './apiClient';

export type VehicleCatalogModel = {
  id: string;
  name: string;
  image_url: string | null;
};

export type VehicleCatalogCompany = {
  id: string;
  name: string;
  models: VehicleCatalogModel[];
};

export const vehicleCatalogService = {
  fetchCatalog: async () => {
    const response = await apiClient.get<VehicleCatalogCompany[]>('/api/v1/vehicle-catalog');
    return response.data;
  },
};
