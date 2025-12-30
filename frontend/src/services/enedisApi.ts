import { buildApiUrl } from "../api/client";

export type EnedisSearchParams = {
  name: string;
  address?: string;
  prm?: string;
};

export type EnedisAddress = {
  ligne4?: string;
  ligne6?: string;
};

export type EnedisSearchResult = {
  nomClientFinalOuDenominationSociale?: string;
  prm?: string;
  categorieClientFinalCode?: string;
  adresseInstallationNormalisee?: EnedisAddress;
  contractUuid?: string;
  uuid?: string;
  id?: string;
  [key: string]: unknown;
};

export type CreateAskPayload = {
  electricityContracts: string[];
  signer: {
    firstName: string;
    lastName: string;
  };
  purposes: string[];
  consentDuration: string;
  email: string;
  firstName?: string;
  lastName?: string;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  prm?: string;
};

export type SwitchgridRequestDto = {
  id: string;
  orderId: string;
  order?: { prospectId: string };
  switchgridRequestId?: string | null;
  requestType: string;
  status: string;
  orderedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  dataUrl?: string | null;
  dataJson?: unknown;
  createdAt: string;
};

export type EnedisContractDetailsDto = {
  id: string;
  prospectId: string;
  switchgridRequestId: string;
  prm?: string | null;
  customerType?: string | null;
  contractHolderName?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  addressLine4?: string | null;
  addressLine5?: string | null;
  addressLine6?: string | null;
  subscribedPowerKva?: number | null;
  tariffOption?: string | null;
  meterType?: string | null;
  direction?: string | null;
  hpHcScheduleJson?: unknown;
  rawJson?: unknown;
  createdAt: string;
};

export type EnedisMonthlyConsumptionDto = {
  id: string;
  prospectId: string;
  switchgridRequestId: string;
  direction: string;
  meteringMode: string;
  year: number;
  month: number;
  consumptionTotal: number;
  consumptionHP?: number | null;
  consumptionHC?: number | null;
  consumptionDaytime?: number | null;
  createdAt: string;
};

export type EnedisDailyConso3Dto = {
  id: string;
  prospectId: string;
  switchgridRequestId: string;
  prm?: string | null;
  date: string;
  direction?: string | null;
  EnergyTotalKwh?: number | null;
  EnergyHpKwh?: number | null;
  EnergyHcKwh?: number | null;
  EnergyDayTimeKwh?: number | null;
  consoByHourTable?: { id: string; hour: number; energy?: number | null }[];
};

export async function getAskStatus(askId: string): Promise<{ status?: string }> {
  const url = buildApiUrl(`/api/enedis/ask/${encodeURIComponent(askId)}`);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Requête échouée (${response.status})`);
  }
  return response.json() as Promise<{ status?: string }>;
}

export async function searchContract(params: EnedisSearchParams): Promise<EnedisSearchResult[]> {
  const name = params.name.trim();
  const address = params.address?.trim();
  const prm = params.prm?.trim();

  if (!name) {
    throw new Error("Le nom est requis");
  }
  if (!address && !prm) {
    throw new Error("Saisissez une adresse ou un PRM");
  }

  const query = new URLSearchParams();
  query.set("name", name);
  if (address) query.set("address", address);
  if (prm) query.set("prm", prm);

  const url = `${buildApiUrl("/api/enedis/search-contract")}?${query.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Requête échouée (${response.status})`);
  }

  const data = (await response.json()) as { results?: EnedisSearchResult[] } | EnedisSearchResult[];

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  throw new Error("Réponse inattendue du serveur");
}

export async function createAsk(payload: CreateAskPayload): Promise<{ message?: string }> {
  const url = buildApiUrl("/api/enedis/ask");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Requête échouée (${response.status})`);
    }

    return response.json();
  } catch (error) {
    // Si le backend n'est pas prêt, on mock la réponse pour permettre les tests UI.
    console.warn("createAsk fallback (mock)", error);
    return Promise.resolve({ message: "(Mock) Demande envoyée" });
  }
}

export async function getRequests(prospectId: string): Promise<SwitchgridRequestDto[]> {
  const url = buildApiUrl(`/api/enedis/requests?prospectId=${encodeURIComponent(prospectId)}`);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Requête échouée (${response.status})`);
  }
  return response.json() as Promise<SwitchgridRequestDto[]>;
}

export async function getContractDetails(prospectId: string): Promise<EnedisContractDetailsDto> {
  const url = buildApiUrl(`/api/enedis/contract-details?prospectId=${encodeURIComponent(prospectId)}`);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Requête échouée (${response.status})`);
  }
  return response.json() as Promise<EnedisContractDetailsDto>;
}

export async function getMonthlyConsumption(prospectId: string): Promise<EnedisMonthlyConsumptionDto[]> {
  const url = buildApiUrl(`/api/enedis/prospects/${encodeURIComponent(prospectId)}/monthly-consumption`);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Requête échouée (${response.status})`);
  }
  return response.json() as Promise<EnedisMonthlyConsumptionDto[]>;
}

export async function getMonthlyConsumptionR65(prospectId: string): Promise<EnedisMonthlyConsumptionDto[]> {
  const url = buildApiUrl(`/api/enedis/prospects/${encodeURIComponent(prospectId)}/monthly-consumption2`);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Requête échouée (${response.status})`);
  }
  return response.json() as Promise<EnedisMonthlyConsumptionDto[]>;
}

export async function getMonthlyConsumptionLoadcurve(prospectId: string): Promise<EnedisMonthlyConsumptionDto[]> {
  const url = buildApiUrl(`/api/enedis/prospects/${encodeURIComponent(prospectId)}/monthly-consumption3`);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Requête échouée (${response.status})`);
  }
  return response.json() as Promise<EnedisMonthlyConsumptionDto[]>;
}

export async function getDailyConsoLoadcurve(prospectId: string): Promise<EnedisDailyConso3Dto[]> {
  const url = buildApiUrl(`/api/enedis/prospects/${encodeURIComponent(prospectId)}/daily-conso3`);
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Requête échouée (${response.status})`);
  }
  return response.json() as Promise<EnedisDailyConso3Dto[]>;
}
