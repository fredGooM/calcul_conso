import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  SwitchgridRequestDto,
  EnedisMonthlyConsumptionDto,
  getRequests,
  getMonthlyConsumption,
  getMonthlyConsumptionR65
} from "../services/enedisApi";

const DEFAULT_ORDER_ID = "b833b995-384c-4b4f-8502-5ef90c75c87b";

export default function CheckRequest() {
  const [orderId, setOrderId] = useState(DEFAULT_ORDER_ID);
  const [requests, setRequests] = useState<SwitchgridRequestDto[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<EnedisMonthlyConsumptionDto[]>([]);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [monthlySource, setMonthlySource] = useState<"R64" | "R65">("R64");
  const [loading, setLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [prospectId, setProspectId] = useState<string | null>(null);

  const monthlyMax = 1500;

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

  const handleLoadRequests = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    setLoading(true);
    setRequestsError(null);
    setMonthlyData([]);
    setMonthlyError(null);
    try {
      const data = await getRequests(""); // backend renvoie toutes les requests si prospectId vide
      const filtered = data.filter((r) => r.orderId === orderId);
      setRequests(filtered);
      const prospect = filtered[0]?.order?.prospectId ?? null;
      setProspectId(prospect);
    } catch (err) {
      setRequestsError((err as Error).message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthly = async (source: "R64" | "R65") => {
    if (!prospectId) {
      setMonthlyError("Aucun prospect trouvé pour cet order.");
      return;
    }
    setMonthlyLoading(true);
    setMonthlyError(null);
    setMonthlySource(source);
    try {
      const data = source === "R64" ? await getMonthlyConsumption(prospectId) : await getMonthlyConsumptionR65(prospectId);
      setMonthlyData(data);
    } catch (err) {
      setMonthlyError((err as Error).message);
      setMonthlyData([]);
    } finally {
      setMonthlyLoading(false);
    }
  };

  return (
    <div className="stack results">
      <div className="panel">
        <h3>CheckRequest</h3>
        <form className="form-inline" onSubmit={handleLoadRequests} style={{ gap: "0.5rem" }}>
          <label>
            Order ID
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} style={{ minWidth: "280px" }} />
          </label>
          <button type="submit" className="btn btn-orange" disabled={loading}>
            {loading ? "Chargement..." : "Charger"}
          </button>
        </form>
      </div>

      <div className="panel">
        <h4>Données reçues (Switchgrid requests)</h4>
        {requestsError && <p className="error">Erreur : {requestsError}</p>}
        {!requestsError && requests.length === 0 && !loading && <p className="muted">Aucune donnée pour cet order.</p>}
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
                  <p className="muted">Donnée non disponible</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="form-inline" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <h4>Consommation mensuelle</h4>
          <div className="form-inline" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className={`btn ${monthlySource === "R64" ? "btn-orange" : "secondary"}`}
              onClick={() => loadMonthly("R64")}
              disabled={monthlyLoading}
            >
              AffichageDonnéeR64
            </button>
            <button
              type="button"
              className={`btn ${monthlySource === "R65" ? "btn-orange" : "secondary"}`}
              onClick={() => loadMonthly("R65")}
              disabled={monthlyLoading}
            >
              AffichageDonnéeR65
            </button>
          </div>
        </div>
        {monthlyError && <p className="error">Erreur : {monthlyError}</p>}
        {!monthlyError && monthlyData.length === 0 && !monthlyLoading && <p className="muted">Aucune donnée mensuelle.</p>}
        {monthlyData.length > 0 && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              {recentYears.map((y, idx) => (
                <div key={y} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "14px",
                      height: "14px",
                      background: idx === 0 ? "#a3a3a3" : "#f97316",
                      display: "inline-block",
                      borderRadius: "3px"
                    }}
                  />
                  <span className="muted">Année {y}</span>
                </div>
              ))}
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
            <p className="muted" style={{ marginTop: "0.5rem" }}>Consommation totale par mois (kWh)</p>
          </div>
        )}
      </div>
    </div>
  );
}
