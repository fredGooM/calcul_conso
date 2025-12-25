import { FormEvent, useState } from "react";
import { EnedisSearchResult, searchContract } from "../services/enedisApi";

type SearchMode = "address" | "prm";

export default function EnedisSearchContract() {
  const [mode, setMode] = useState<SearchMode>("address");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [prm, setPrm] = useState("");
  const [results, setResults] = useState<EnedisSearchResult[]>([]);
  const [rawOpen, setRawOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setResults([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

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
          <ul className="stack">
            {results.map((item, index) => {
              const key = `${item.prm ?? item.nomClientFinalOuDenominationSociale ?? "result"}-${index}`;
              const addressLine = [item.adresseInstallationNormalisee?.ligne4, item.adresseInstallationNormalisee?.ligne6]
                .filter(Boolean)
                .join(" • ");

              return (
                <li key={key} className="card">
                  <div className="form-inline" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
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
        )}

        <details open={rawOpen} onToggle={(e) => setRawOpen((e.target as HTMLDetailsElement).open)} style={{ marginTop: "1rem" }}>
          <summary>JSON brut</summary>
          <pre style={{ maxHeight: "240px", overflow: "auto" }}>{JSON.stringify(results, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}
