// Normalize base: accept values with or without trailing "/api"
const rawBase = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
const API_BASE = rawBase.endsWith("/api") ? rawBase.slice(0, -4) : rawBase;

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
  runSimulation: (payload: SimulationRequest) => request<SimulationResponse>("/api/simulations", { method: "POST", body: payload }),
  getEquipementDescription: () => request<EquipementDescriptionEntry[]>("/api/equipement_description"),
  getTableday: () => request<TabledayEntry[]>("/api/tableday")
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
  applicable_surface?: number;
  applicable_persons?: number;
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
  houseMonthlySolar: Monthly & { annual_total?: number };
  annual_consumption_solar: number;
  annual_consumption_simulated: number;
  coefficient: number;
  climate_zone: Climate;
  consumptionByCategory: Record<
    string,
    {
      monthly: Monthly;
      annual: number;
    }
  >;
  total: {
    monthly: Monthly;
    annual: number;
  };
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

export type EquipementDescriptionEntry = {
  equipment_category: string;
  equipment_type: string;
  label: string;
  tableday_bycategory: "heating" | "air_cond" | "pool" | "other";
  consumption_unit: "house_surface" | "number_person" | "pool_volume" | "number_equipement";
  equipment_energy_label: string;
  consumption: number;
  presence_sensitive: boolean;
  isolation_sensitive: boolean;
  energybox_sensitive: boolean;
  solarhours_perday_percent?: number;
};

export type TabledayEntry = {
  category: "heating" | "air_cond" | "pool" | "other";
  month: string;
  H1_days: number;
  H2_days: number;
  H3_days: number;
  H1: number;
  H2: number;
  H3: number;
};
