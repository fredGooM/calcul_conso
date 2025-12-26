import { FormEvent, useMemo, useState, useEffect } from "react";
import { EnedisSearchResult, createAsk, getAskStatus, searchContract } from "../services/enedisApi";

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
  const [askStatus, setAskStatus] = useState<string | null>(null);

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
      setAskId(newAskId);
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
    if (!askId) return;
    let cancelled = false;

    async function poll() {
      try {
        if (!askId) return;
        const statusResp = await getAskStatus(askId);
        if (cancelled) return;
        setAskStatus(statusResp.status ?? null);
      } catch (err) {
        console.warn("Polling ask status failed", err);
      }
    }

    // Immediate poll then interval
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [askId]);

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
          </>
        )}

        <details open={rawOpen} onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)} style={{ marginTop: "1rem" }}>
          <summary>JSON brut</summary>
          <pre style={{ maxHeight: "240px", overflow: "auto" }}>{JSON.stringify(results, null, 2)}</pre>
        </details>
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
