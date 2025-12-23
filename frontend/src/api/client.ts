const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

type HttpMethod = "GET" | "POST";

async function request<T>(path: string, options: { method?: HttpMethod; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = options;
  const url = `${API_BASE}${path}`;

  const resp = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!resp.ok) {
    const message = await safeParseError(resp);
    throw new Error(message || `Request failed with status ${resp.status}`);
  }

  return resp.json() as Promise<T>;
}

async function safeParseError(resp: Response): Promise<string | null> {
  try {
    const data = await resp.json();
    return (data as { error?: string }).error ?? null;
  } catch {
    return null;
  }
}

export const api = {
  getCatalog: () => request<CatalogResponse>("/api/catalog"),
  getClimateZone: (zip: string) => request<ClimateZoneResponse>(`/utils/climate-zone?zip=${encodeURIComponent(zip)}`),
  runSimulation: (payload: SimulationRequest) => request<SimulationResponse>("/api/simulations", { method: "POST", body: payload })
};

// Types
export type Presence = "Actif" | "TT1j" | "TT2j" | "TT3j" | "TT4j" | "TT5j_Retraite";
export type Climate = "H1" | "H2" | "H3";
export type Dpe = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type HouseInput = {
  annual_consumption: number; // UI field name; mapped to annual_consumption_kWh when sending
  presence: Presence;
  number_person: number;
  pool_volume: number;
  surface: number;
  dpe: Dpe;
  zip_code: string;
  water_heater_during_day: boolean;
};

export type CatalogEquipment = {
  equipment_type: string;
  label: string;
  tableday_bycategory: "heating" | "air_cond" | "pool" | "other";
  consumption_unit: "house_surface" | "number_person" | "pool_volume" | "number_equipement";
  consumption: number;
};

export type CatalogResponse = {
  categories: string[];
  equipmentByCategory: Record<string, CatalogEquipment[]>;
};

export type SelectedEquipment = {
  equipment_category: string;
  equipment_type: string;
  number_equipement: number;
};

export type Monthly = {
  january: number;
  february: number;
  march: number;
  april: number;
  may: number;
  june: number;
  july: number;
  august: number;
  septembre: number;
  october: number;
  november: number;
  december: number;
};

export type SimulationResponse = {
  houseId: string;
  houseMonthlySimulated: Monthly;
  houseMonthly: Monthly;
  annual_consumption_simulated: number;
  coefficient: number;
  climate_zone: Climate;
  equipments: Array<{
    equipment: {
      id: string;
      equipment_category: string;
      equipment_type: string;
      label: string;
      number_equipement: number;
      consumption: number;
    };
    monthly: Monthly;
  }>;
};

export type SimulationRequest = {
  house: {
    annual_consumption_kWh: number;
    presence: Presence;
    number_person: number;
    pool_volume: number;
    surface: number;
    dpe: Dpe;
    zip_code: string;
    water_heater_during_day: boolean;
  };
  selectedEquipments: SelectedEquipment[];
};

export type ClimateZoneResponse = {
  zip: string;
  department: string;
  climate_zone: Climate;
};
