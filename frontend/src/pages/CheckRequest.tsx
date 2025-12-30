import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  SwitchgridRequestDto,
  EnedisMonthlyConsumptionDto,
  EnedisDailyConso3Dto,
  getRequests,
  getMonthlyConsumption,
  getMonthlyConsumptionR65,
  getMonthlyConsumptionLoadcurve,
  getDailyConsoLoadcurve
} from "../services/enedisApi";

const DEFAULT_ORDER_ID = "ff6e7d44-9856-47f5-af44-a138b3887a04";

export default function CheckRequest() {
  const [orderId, setOrderId] = useState(DEFAULT_ORDER_ID);
  const [requests, setRequests] = useState<SwitchgridRequestDto[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<EnedisMonthlyConsumptionDto[]>([]);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [monthlySource, setMonthlySource] = useState<"R64" | "R65" | "LC">("R64");
  const [loading, setLoading] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [dailyLC, setDailyLC] = useState<EnedisDailyConso3Dto[]>([]);
  const [dailyLCError, setDailyLCError] = useState<string | null>(null);
  const [dailyLCLoading, setDailyLCLoading] = useState(false);
  const [selectedDailyId, setSelectedDailyId] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState<{ hour: number; energy?: number | null }[]>([]);

  const monthlyMax = useMemo(() => {
    const vals: number[] = [];
    monthlyData.forEach((m) => {
      const total = m.consumptionTotal ?? 0;
      vals.push(total);
    });
    const maxVal = vals.length ? Math.max(...vals) : 0;
    return Math.max(1, maxVal);
  }, [monthlyData]);

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
    const lookup = new Map<string, { total: number; daytime: number }>();
    for (const m of monthlyData) {
      if (m.year === prevYear || m.year === currentYear) {
        lookup.set(`${m.year}-${m.month}`, {
          total: m.consumptionTotal ?? 0,
          daytime: m.consumptionDaytime ?? 0
        });
      }
    }
    const months: { month: number; prev?: number; current?: number; prevDay?: number; currentDay?: number }[] = [];
    for (let i = 1; i <= 12; i += 1) {
      const prevVal = lookup.get(`${prevYear}-${i}`);
      const curVal = lookup.get(`${currentYear}-${i}`);
      months.push({
        month: i,
        prev: prevVal?.total,
        current: curVal?.total,
        prevDay: prevVal?.daytime,
        currentDay: curVal?.daytime
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
    setDailyLC([]);
    setDailyLCError(null);
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
            <button
              type="button"
              className="btn secondary"
              onClick={async () => {
                if (!prospectId) return;
                setMonthlyLoading(true);
                setMonthlyError(null);
                setDailyLCError(null);
                setDailyLCLoading(true);
                try {
                  const data = await getMonthlyConsumptionLoadcurve(prospectId);
                  setMonthlyData(data);
                  const daily = await getDailyConsoLoadcurve(prospectId);
                  setDailyLC(daily);
                } catch (err) {
                  const msg = (err as Error).message;
                  setMonthlyError(msg);
                  setMonthlyData([]);
                  setDailyLCError(msg);
                  setDailyLC([]);
                } finally {
                  setMonthlyLoading(false);
                  setDailyLCLoading(false);
                  setMonthlySource("LC");
                }
              }}
              disabled={monthlyLoading || dailyLCLoading}
            >
              AffichageDonnéeLoadcurveMois
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={async () => {
                if (!prospectId) return;
                setDailyLCLoading(true);
                setDailyLCError(null);
                try {
                  const daily = await getDailyConsoLoadcurve(prospectId);
                  setDailyLC(daily);
                } catch (err) {
                  setDailyLCError((err as Error).message);
                  setDailyLC([]);
                } finally {
                  setDailyLCLoading(false);
                }
              }}
              disabled={dailyLCLoading}
            >
              AffichageDonnéeLoadcurveJour
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
                  <span style={{ width: "14px", height: "14px", background: idx === 0 ? "#a3a3a3" : "#f97316", display: "inline-block", borderRadius: "3px" }} />
                  <span className="muted">Année {y} (Total)</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px" }}>
                <span style={{ width: "14px", height: "14px", background: "#22c55e", display: "inline-block", borderRadius: "3px" }} />
                <span className="muted">Daytime 9-18</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "240px", paddingBottom: "8px", overflowX: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "220px", paddingRight: "6px", borderRight: "1px solid #ddd", fontSize: "0.75rem" }}>
                <span>{monthlyMax.toFixed(0)}</span>
                <span>{(monthlyMax / 2).toFixed(0)}</span>
                <span>0</span>
              </div>
              {monthlySource === "LC" ? (
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", height: "220px", borderBottom: "1px solid #ddd", paddingBottom: "8px" }}>
                  {monthlySorted.map((m) => {
                    const label = `${String(m.month).padStart(2, "0")}/${m.year}`;
                    const total = m.consumptionTotal ?? 0;
                    const daytime = m.consumptionDaytime ?? 0;
                    const pctTotal = monthlyMax > 0 ? Math.max(5, Math.round((total / monthlyMax) * 100)) : 0;
                    const pctDay = monthlyMax > 0 ? Math.max(2, Math.round((daytime / monthlyMax) * 100)) : 0;
                    return (
                      <div key={`${m.year}-${m.month}`} style={{ textAlign: "center", flex: "0 0 60px" }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "180px" }}>
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                            <div
                              style={{
                                background: "#22c55e",
                                width: "14px",
                                height: `${pctDay}%`,
                                minHeight: pctDay > 0 ? "6px" : "0",
                                borderRadius: "4px 4px 0 0",
                                transition: "height 0.2s ease"
                              }}
                              title={`${label} Daytime: ${daytime.toFixed(0)} kWh`}
                            />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                            <div
                              style={{
                                background: "#f97316",
                                width: "14px",
                                height: `${pctTotal}%`,
                                minHeight: "6px",
                                borderRadius: "4px 4px 0 0",
                                transition: "height 0.2s ease"
                              }}
                              title={`${label} Total: ${total.toFixed(0)} kWh`}
                            />
                          </div>
                        </div>
                        <div style={{ fontSize: "0.7rem", marginTop: "6px" }}>{label}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "220px", borderBottom: "1px solid #ddd", paddingBottom: "8px" }}>
                  {monthlyTwoYears.map((m) => {
                    const bars = [
                      { year: recentYears[0], value: m.prev, daytime: m.prevDay, color: "#a3a3a3" },
                      { year: recentYears[1], value: m.current, daytime: m.currentDay, color: "#f97316" }
                    ].filter((b) => b.value !== undefined);
                    const label = String(m.month).padStart(2, "0");
                    return (
                      <div key={`m-${m.month}`} style={{ textAlign: "center", flex: "0 0 48px" }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "180px" }}>
                          {bars.map((b) => {
                            const total = b.value as number;
                            const daytime = b.daytime ?? 0;
                            const pctTotal = monthlyMax > 0 ? Math.max(5, Math.round((total / monthlyMax) * 100)) : 0;
                            const pctDay = monthlyMax > 0 ? Math.round((daytime / monthlyMax) * 100) : 0;
                            return (
                              <div key={`${b.year}-${m.month}`} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
                                <div
                                  style={{
                                    background: b.color,
                                    width: "14px",
                                    height: `${pctTotal}%`,
                                    minHeight: "6px",
                                    borderRadius: "4px 4px 0 0",
                                    transition: "height 0.2s ease"
                                  }}
                                  title={`${label}/${b.year} Total: ${total.toFixed(0)} kWh`}
                                />
                                <div
                                  style={{
                                    background: "#22c55e",
                                    width: "14px",
                                    height: `${pctDay}%`,
                                    minHeight: pctDay > 0 ? "4px" : "0",
                                    borderRadius: "0 0 4px 4px",
                                    marginTop: "2px",
                                    transition: "height 0.2s ease"
                                  }}
                                  title={`${label}/${b.year} Daytime: ${daytime.toFixed(0)} kWh`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: "0.7rem", marginTop: "6px" }}>{label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="muted" style={{ marginTop: "0.5rem" }}>Consommation totale par mois (kWh)</p>
          </div>
        )}
      </div>

      <div className="panel">
        <h4>Consommations journalières (Loadcurve)</h4>
        {dailyLCError && <p className="error">Erreur : {dailyLCError}</p>}
        {!dailyLCError && dailyLC.length === 0 && !dailyLCLoading && <p className="muted">Aucune donnée journalière.</p>}
        {!dailyLCError && dailyLC.length > 0 && (
          <>
          <div className="form-inline" style={{ gap: "0.5rem", marginBottom: "0.5rem" }}>
            <button
              type="button"
              className="btn secondary"
              disabled={!selectedDailyId}
              onClick={() => {
                const sel = dailyLC.find((d) => d.id === selectedDailyId);
                setSelectedHours(sel?.consoByHourTable ?? []);
              }}
            >
              AffichageHeureparHeure
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Date</th>
                <th>Total (kWh)</th>
                <th>HP (kWh)</th>
                <th>HC (kWh)</th>
                <th>Daytime 9-18 (kWh)</th>
              </tr>
            </thead>
            <tbody>
              {dailyLC.slice(0, 60).map((d) => (
                <tr key={d.id}>
                  <td>
                    <input
                      type="radio"
                      name="dailySelect"
                      checked={selectedDailyId === d.id}
                      onChange={() => setSelectedDailyId(d.id)}
                    />
                  </td>
                  <td>{new Date(d.date).toLocaleDateString()}</td>
                  <td>{d.EnergyTotalKwh?.toFixed(1) ?? "—"}</td>
                  <td>{d.EnergyHpKwh?.toFixed(1) ?? "—"}</td>
                  <td>{d.EnergyHcKwh?.toFixed(1) ?? "—"}</td>
                  <td>{d.EnergyDayTimeKwh?.toFixed(1) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedHours.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <h5>Heures du jour sélectionné</h5>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {selectedHours.map((h) => (
                  <div key={h.hour} className="card" style={{ padding: "6px 8px", minWidth: "80px" }}>
                    <div className="muted">{String(h.hour).padStart(2, "0")}h</div>
                    <strong>{h.energy !== undefined && h.energy !== null ? h.energy.toFixed(2) : "—"} kWh</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
