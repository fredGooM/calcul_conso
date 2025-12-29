import { FormEvent, useMemo, useState, useEffect } from "react";
import {
  EnedisSearchResult,
  SwitchgridRequestDto,
  EnedisContractDetailsDto,
  EnedisMonthlyConsumptionDto,
  createAsk,
  getAskStatus,
  getRequests,
  getContractDetails,
  getMonthlyConsumption,
  getMonthlyConsumptionR65,
  searchContract
} from "../services/enedisApi";

type SearchMode = "address" | "prm";

export default function EnedisSearchContract() {
  const [mode, setMode] = useState<SearchMode>("address");
  const [name, setName] = useState("Dupont");
  const [address, setAddress] = useState("10 rue de la paix 75002 Paris");
  const [prm, setPrm] = useState("");
  const [results, setResults] = useState<EnedisSearchResult[]>([]);
  const [rawOpen, setRawOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<EnedisSearchResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState(import.meta.env.DEV ? "fred@goom.digital" : "fred@goom.digital");
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askSuccess, setAskSuccess] = useState<string | null>(null);
  const [askId, setAskId] = useState<string | null>(null);
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [askStatus, setAskStatus] = useState<string | null>(null);
  const [requests, setRequests] = useState<SwitchgridRequestDto[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [contractDetails, setContractDetails] = useState<EnedisContractDetailsDto | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<EnedisMonthlyConsumptionDto[]>([]);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlySource, setMonthlySource] = useState<"R64" | "R65">("R64");

  const hasC68Success = useMemo(
    () => requests.some((r) => r.requestType === "C68" && r.status === "SUCCESS"),
    [requests]
  );

  const selectedContractId = useMemo(() => {
    if (!selectedContract) return null;
    return (
      selectedContract.contractUuid ||
      selectedContract.uuid ||
      selectedContract.id ||
      selectedContract.prm ||
      null
    );
  }, [selectedContract]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    // reset affichages des données reçues
    setRequests([]);
    setRequestsError(null);
    setMonthlyData([]);
    setMonthlyError(null);
    setContractDetails(null);
    setContractError(null);
    setAskStatus(null);

    try {
      const payload =
        mode === "address"
          ? { name, address, prm: undefined }
          : { name, prm, address: undefined };

      const data = await searchContract(payload);
      setResults(data);
      setSelectedContract(null);
    } catch (err) {
      setResults([]);
      console.warn("Search contract failed", err);
      setError("La recherche n'a pas abouti, veuillez remplir correctement le champs adresse et nom");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setAskError(null);
    setAskSuccess(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setAskError(null);
    setAskLoading(false);
  };

  const monthlySorted = useMemo(() => {
    const copy = [...monthlyData];
    copy.sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
    return copy;
  }, [monthlyData]);

  const recentYears = useMemo(() => {
    const years = Array.from(new Set(monthlyData.map((m) => m.year))).sort((a, b) => a - b);
    if (years.length === 0) return [];
    const last = years[years.length - 1];
    return [last - 1, last];
  }, [monthlyData]);

  const monthlyTwoYears = useMemo(() => {
    if (recentYears.length === 0) return [];
    const [prevYear, currentYear] = recentYears;
    const lookup = new Map<string, number>();
    for (const m of monthlyData) {
      if (m.year === prevYear || m.year === currentYear) {
        lookup.set(`${m.year}-${m.month}`, m.consumptionTotal ?? 0);
      }
    }
    const months: { month: number; prev?: number; current?: number }[] = [];
    for (let i = 1; i <= 12; i += 1) {
      months.push({
        month: i,
        prev: lookup.get(`${prevYear}-${i}`),
        current: lookup.get(`${currentYear}-${i}`)
      });
    }
    return months;
  }, [monthlyData, recentYears]);

  const monthlyMax = 1500; // échelle fixe demandée (kWh)

  const handleSendAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedContractId) return;
    setAskError(null);
    setAskSuccess(null);

    if (!email || !email.trim()) {
      setAskError("Email invalide");
      return;
    }

    setAskLoading(true);
    try {
      const contractName = selectedContract?.nomClientFinalOuDenominationSociale ?? name;
      const addressLine =
        selectedContract?.adresseInstallationNormalisee?.ligne4 ??
        selectedContract?.adresseInstallationNormalisee?.ligne6 ??
        address;
      const postalCodeMatch = selectedContract?.adresseInstallationNormalisee?.ligne6?.match(/\\b(\\d{5})\\b/);
      const postalCode = postalCodeMatch ? postalCodeMatch[1] : undefined;
      const prmSelected = selectedContract?.prm;

      const payload = {
        electricityContracts: [selectedContractId],
        signer: { firstName: contractName || "Prospect", lastName: "Unknown" },
        purposes: ["SOLAR_INSTALLATION_SIZING"],
        consentDuration: "3 years",
        email,
        firstName: contractName || undefined,
        lastName: undefined,
        addressLine,
        postalCode,
        city: undefined,
        prm: prmSelected ?? undefined
      };

      const resp = await createAsk(payload);
      const newAskId = (resp as any)?.askId ?? (resp as any)?.id ?? (resp as any)?.switchgridAskId ?? null;
      const newProspectId = (resp as any)?.prospectId ?? null;
      setAskId(newAskId);
      setProspectId(newProspectId);
      setAskStatus((resp as any)?.status ?? null);
      setAskSuccess(resp.message ?? "Demande envoyée");
      setShowModal(false);
    } catch (err) {
      setAskError((err as Error).message);
    } finally {
      setAskLoading(false);
    }
  };

  // Poll ask status when we have an askId
  useEffect(() => {
    if (!askId || askStatus === "ACCEPTED") return;
    let cancelled = false;

    async function poll() {
      try {
        if (!askId) return;
        const statusResp = await getAskStatus(askId);
        if (cancelled) return;
        const nextStatus = statusResp.status ?? null;
        setAskStatus(nextStatus);
        if (nextStatus === "ACCEPTED") {
          cancelled = true;
        }
      } catch (err) {
        console.warn("Polling ask status failed", err);
      }
    }

    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [askId, askStatus]);

  // Poll Switchgrid requests (light) to display received dataJson
  useEffect(() => {
    if (!prospectId) return;
    let cancelled = false;

    async function loadRequests(currentProspectId: string) {
      try {
        const data = await getRequests(currentProspectId);
        if (cancelled) return;
        setRequests(data);
        setRequestsError(null);
      } catch (err) {
        if (cancelled) return;
        setRequestsError((err as Error).message);
      }
    }

    const currentId = prospectId;
    loadRequests(currentId);
    const interval = setInterval(() => loadRequests(currentId), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [prospectId]);

  // Poll contract details for the current prospect
  useEffect(() => {
    if (!prospectId) return;
    if (!hasC68Success) {
      setContractDetails(null);
      setContractError(null);
      return;
    }

    let cancelled = false;

    async function loadContract(currentProspectId: string) {
      try {
        const data = await getContractDetails(currentProspectId);
        if (cancelled) return;
        setContractDetails(data);
        setContractError(null);
      } catch (err) {
        if (cancelled) return;
        setContractError((err as Error).message);
      }
    }

    const currentId = prospectId;
    loadContract(currentId);
    const interval = setInterval(() => loadContract(currentId), 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [prospectId, requests]);

  async function handleLoadMonthly() {
    if (!prospectId) return;
    setMonthlyLoading(true);
    setMonthlyError(null);
    try {
      const data = await getMonthlyConsumption(prospectId);
      setMonthlyData(data);
    } catch (err) {
      setMonthlyError((err as Error).message);
      setMonthlyData([]);
    } finally {
      setMonthlyLoading(false);
    }
  }

  return (
    <div className="stack results">
      <div className="panel">
        <h3>Recherche contrat Enedis</h3>

        <form className="stack" onSubmit={handleSubmit}>
          <div className="form-inline">
            <label className="checkbox">
              <input type="radio" name="mode" value="address" checked={mode === "address"} onChange={() => setMode("address")} />
              Par adresse
            </label>
            <label className="checkbox">
              <input type="radio" name="mode" value="prm" checked={mode === "prm"} onChange={() => setMode("prm")} />
              Par PRM
            </label>
          </div>

          <div className="form-grid">
            <label>
              Nom ou Raison sociale (obligatoire)
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" required />
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Le nom doit correspondre à celui sur la facture
              </span>
            </label>

            {mode === "address" && (
              <label>
                Adresse
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="10 rue de la Paix 75002 Paris" required />
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  Exemple de format d'adresse : 5 rue des naiades 34470 Pérols
                </span>
              </label>
            )}

            {mode === "prm" && (
              <label>
                PRM
                <input value={prm} onChange={(e) => setPrm(e.target.value)} placeholder="14123456789012" required />
              </label>
            )}
          </div>

            <div className="form-inline">
              <button type="submit" className="btn btn-orange" disabled={loading}>
                {loading ? "Recherche..." : "Rechercher"}
              </button>
              {error && <span className="error">Erreur : {error}</span>}
            </div>

            {prospectId && (
              <div className="panel" style={{ marginTop: "0.5rem" }}>
                <h4>Détails contrat</h4>
                {hasC68Success && contractError && <p className="error">Erreur : {contractError}</p>}
                {!contractError && !contractDetails && <p className="muted">En attente des détails (C68)...</p>}
                {contractDetails && (
                  <div className="stack">
                    <div className="form-inline" style={{ gap: "1rem" }}>
                      <div>
                        <p className="muted">PRM</p>
                        <strong>{contractDetails.prm ?? "—"}</strong>
                      </div>
                      <div>
                        <p className="muted">Type client</p>
                        <strong>{contractDetails.customerType ?? "—"}</strong>
                      </div>
                      <div>
                        <p className="muted">Puissance souscrite (kVA)</p>
                        <strong>{contractDetails.subscribedPowerKva ?? "—"}</strong>
                      </div>
                      <div>
                        <p className="muted">Tarif</p>
                      <strong>{contractDetails.tariffOption ?? "—"}</strong>
                    </div>
                    <div>
                      <p className="muted">Type de compteur</p>
                      <strong>{contractDetails.meterType ?? "—"}</strong>
                    </div>
                  </div>
                  {contractDetails.hpHcScheduleJson && contractDetails.tariffOption !== "Heures Pleines" ? (
                    <div>
                      <p className="muted">Horaires HP/HC</p>
                      <pre style={{ maxHeight: "160px", overflow: "auto" }}>
                        {JSON.stringify(contractDetails.hpHcScheduleJson as Record<string, unknown>, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

      <div className="panel">
        <h4>Résultats</h4>
        {loading && <p className="muted">Recherche en cours...</p>}
        {!loading && results.length === 0 && !error && <p className="muted">Aucun résultat pour l’instant.</p>}

        {!loading && results.length > 0 && (
          <>
            <ul className="stack">
            {results.map((item, index) => {
              const key = `${item.prm ?? item.nomClientFinalOuDenominationSociale ?? "result"}-${index}`;
              const addressLine = [item.adresseInstallationNormalisee?.ligne4, item.adresseInstallationNormalisee?.ligne6]
                .filter(Boolean)
                .join(" • ");

              return (
                <li key={key} className="card" style={{ borderColor: selectedContract === item ? "#f97316" : undefined }}>
                  <div className="form-inline" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <label className="checkbox" style={{ alignSelf: "flex-start", paddingTop: "6px" }}>
                      <input
                        type="radio"
                        name="contract"
                        checked={selectedContract === item}
                        onChange={() => setSelectedContract(item)}
                      />
                    </label>
                    <div>
                      <p className="muted">Client</p>
                      <strong>{item.nomClientFinalOuDenominationSociale ?? "—"}</strong>
                    </div>
                    <div>
                      <p className="muted">PRM</p>
                      <div className="form-inline" style={{ gap: "0.5rem" }}>
                        <span>{item.prm ?? "—"}</span>
                      </div>
                    </div>
                    <div>
                      <p className="muted">Catégorie</p>
                      <span>
                        {item.categorieClientFinalCode === "RES" ? "Résidentiel" : "Professionel"}
                      </span>
                    </div>
                  </div>
                  <div className="muted" style={{ marginTop: "0.5rem" }}>
                    {addressLine || "Adresse non fournie"}
                  </div>
                </li>
              );
            })}
          </ul>
            <div className="form-inline" style={{ marginTop: "1rem", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-orange"
                disabled={!selectedContract || askLoading}
                onClick={handleOpenModal}
              >
                Envoyer demande de récupération
              </button>
              {askSuccess && <span className="muted">{askSuccess}</span>}
              {askStatus === "ACCEPTED" && (
                <span className="muted" style={{ color: "#16a34a", fontWeight: 600 }}>
                  Le client a accepté la demande de récupération des données
                </span>
              )}
            </div>

            <div className="panel" style={{ marginTop: "1rem" }}>
              <h4>Données reçues (Switchgrid requests)</h4>
              {requestsError && <p className="error">Erreur : {requestsError}</p>}
              {!requestsError && requests.length === 0 && <p className="muted">Aucune donnée reçue pour le moment.</p>}
              {!requestsError && requests.length > 0 && (
                <ul className="stack">
                  {requests.map((r) => (
                    <li key={r.id} className="card">
                      <p className="muted">Type</p>
                      <strong>{r.requestType}</strong>
                      {r.dataJson ? (
                        <pre style={{ marginTop: "0.5rem", maxHeight: "240px", overflow: "auto" }}>
                          {JSON.stringify(r.dataJson as any, null, 2) ?? ""}
                        </pre>
                      ) : (
                        <p className="muted">Donnée non disponible pour l’instant</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {prospectId && (
              <div className="panel" style={{ marginTop: "1rem" }}>
                <div className="form-inline" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <h4>Consommation mensuelle</h4>
                  <div className="form-inline" style={{ gap: "0.5rem" }}>
                    <button
                      type="button"
                      className={`btn ${monthlySource === "R64" ? "btn-orange" : "secondary"}`}
                      onClick={async () => {
                        if (!prospectId) return;
                        setMonthlySource("R64");
                        setMonthlyLoading(true);
                        setMonthlyError(null);
                        try {
                          const data = await getMonthlyConsumption(prospectId);
                          setMonthlyData(data);
                        } catch (err) {
                          setMonthlyError((err as Error).message);
                          setMonthlyData([]);
                        } finally {
                          setMonthlyLoading(false);
                        }
                      }}
                      disabled={monthlyLoading}
                    >
                      AffichageDonnéeR64
                    </button>
                    <button
                      type="button"
                      className={`btn ${monthlySource === "R65" ? "btn-orange" : "secondary"}`}
                      onClick={async () => {
                        if (!prospectId) return;
                        setMonthlySource("R65");
                        setMonthlyLoading(true);
                        setMonthlyError(null);
                        try {
                          const data = await getMonthlyConsumptionR65(prospectId);
                          setMonthlyData(data);
                        } catch (err) {
                          setMonthlyError((err as Error).message);
                          setMonthlyData([]);
                        } finally {
                          setMonthlyLoading(false);
                        }
                      }}
                      disabled={monthlyLoading}
                    >
                      AffichageDonnéeR65
                    </button>
                  </div>
                </div>
                {monthlyError && <p className="error">Erreur : {monthlyError}</p>}
                {!monthlyError && monthlyData.length === 0 && !monthlyLoading && (
                  <p className="muted">Aucune donnée mensuelle pour l’instant.</p>
                )}
            {monthlyData.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                {recentYears.length === 0 ? (
                  <p className="muted">Aucune année disponible.</p>
                ) : (
                  <>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "14px", height: "14px", background: "#a3a3a3", display: "inline-block", borderRadius: "3px" }} />
                            <span className="muted">Année {recentYears[0]}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "14px", height: "14px", background: "#f97316", display: "inline-block", borderRadius: "3px" }} />
                            <span className="muted">Année {recentYears[1]}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "240px", paddingBottom: "8px", overflowX: "auto" }}>
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "220px", paddingRight: "6px", borderRight: "1px solid #ddd", fontSize: "0.75rem" }}>
                            <span>{monthlyMax.toFixed(0)}</span>
                            <span>{(monthlyMax / 2).toFixed(0)}</span>
                            <span>0</span>
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "220px", borderBottom: "1px solid #ddd", paddingBottom: "8px" }}>
                            {monthlyTwoYears.map((m) => {
                            const bars = [
                              { year: recentYears[0], value: m.prev, color: "#a3a3a3" },
                              { year: recentYears[1], value: m.current, color: "#f97316" }
                            ].filter((b) => b.value !== undefined);
                            const label = String(m.month).padStart(2, "0");
                            return (
                              <div key={`m-${m.month}`} style={{ textAlign: "center", flex: "0 0 48px" }}>
                                <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "180px" }}>
                            {bars.map((b) => {
                              const val = b.value as number;
                              const pct = monthlyMax > 0 ? Math.max(5, Math.round((val / monthlyMax) * 100)) : 0;
                              return (
                                <div
                                  key={`${b.year}-${m.month}`}
                                  style={{
                                    background: b.color,
                                    width: "16px",
                                    height: `${pct}%`,
                                    minHeight: "8px",
                                    borderRadius: "4px 4px 0 0",
                                    transition: "height 0.2s ease"
                                  }}
                                  title={`${label}/${b.year}: ${val.toFixed(0)} kWh`}
                                />
                              );
                            })}
                          </div>
                                <div style={{ fontSize: "0.7rem", marginTop: "6px" }}>{label}</div>
                              </div>
                            );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                    <p className="muted" style={{ marginTop: "0.5rem" }}>Consommation totale par mois (kWh)</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h4>Demande de consentement pour récupération de données auprès d'Enedis</h4>
            <p className="muted">Un mail va etre envoyé au prospect avec un lien sécurisé pour le consentement.</p>
            <form className="stack" onSubmit={handleSendAsk}>
              <label>
                Email du prospect
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="prospect@example.com"
                />
              </label>
              {askError && <span className="error">Erreur : {askError}</span>}
              <div className="form-inline" style={{ justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn secondary" onClick={handleCloseModal} disabled={askLoading}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-orange" disabled={askLoading}>
                  {askLoading ? "Envoi..." : "Envoyer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
