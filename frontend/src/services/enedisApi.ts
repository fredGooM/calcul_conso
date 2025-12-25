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
  [key: string]: unknown;
};

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
