import { useEffect, useMemo, useState } from "react";
import {
  api,
  CatalogEquipment,
  CatalogResponse,
  Climate,
  EquipementDescriptionEntry,
  HouseInput,
  Monthly,
  SelectedEquipment,
  SimulationResponse,
  TabledayEntry
} from "./api/client";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import "./index.css";

const defaultHouse: HouseInput = {
  annual_consumption: 10000,
  presence: "TT2j",
  number_person: 4,
  pool_volume: 40,
  surface: 100,
  dpe: "C",
  zip_code: "34470",
  water_heater_during_day: false
};

const defaultSelectedEquipments: SelectedEquipment[] = [
  { equipment_category: "chauffage", equipment_type: "radiateur", number_equipement: 1 },
  { equipment_category: "climatisation", equipment_type: "pac_airair", number_equipement: 1 },
  { equipment_category: "chauffe_eau", equipment_type: "ecs_electrique", number_equipement: 1 },
  { equipment_category: "piscine", equipment_type: "piscine", number_equipement: 1 },
  { equipment_category: "electroménager", equipment_type: "refrigerateur", number_equipement: 2 },
  { equipment_category: "electroménager", equipment_type: "lave-linge", number_equipement: 1 },
  { equipment_category: "electroménager", equipment_type: "lave-vaisselle", number_equipement: 1 },
  { equipment_category: "electroménager", equipment_type: "sèche-linge", number_equipement: 1 },
  { equipment_category: "electroménager", equipment_type: "congélateur", number_equipement: 1 },
  { equipment_category: "multimedia", equipment_type: "tv", number_equipement: 1 },
  { equipment_category: "multimedia", equipment_type: "box_Internet", number_equipement: 1 },
  { equipment_category: "multimedia", equipment_type: "pc", number_equipement: 2 },
  { equipment_category: "talon", equipment_type: "talon", number_equipement: 1 }
];

type CatalogState = {
  data?: CatalogResponse;
  loading: boolean;
  error?: string;
};

type SimulationState = {
  data?: SimulationResponse;
  loading: boolean;
  error?: string;
};

function App() {
  const [house, setHouse] = useState<HouseInput>(defaultHouse);
  const [catalogState, setCatalogState] = useState<CatalogState>({ loading: true });
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>("");
  const [equipmentCount, setEquipmentCount] = useState<number>(1);
  const [selectedEquipments, setSelectedEquipments] = useState<SelectedEquipment[]>(defaultSelectedEquipments);
  const [simulationState, setSimulationState] = useState<SimulationState>({ loading: false });
  const [climateZone, setClimateZone] = useState<Climate | null>(null);
  const [climateLoading, setClimateLoading] = useState(false);
  const [climateError, setClimateError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "viz" | "solar" | "config">("form");
  const [activeSubTab, setActiveSubTab] = useState<"viz" | "solar">("viz");
  const [configData, setConfigData] = useState<{
    equipements?: EquipementDescriptionEntry[];
    tableday?: TabledayEntry[];
    loading: boolean;
    error?: string;
  }>({ loading: false });

  useEffect(() => {
    async function loadCatalog() {
      try {
        const data = await api.getCatalog();
        setCatalogState({ data, loading: false });
        setSelectedCategory(data.categories[0] ?? "");
      } catch (error) {
        setCatalogState({ loading: false, error: (error as Error).message });
      }
    }
    loadCatalog();
  }, []);

  const equipmentOptionsForCategory = useMemo(() => {
    if (!catalogState.data || !selectedCategory) return [];
    return catalogState.data.equipmentByCategory[selectedCategory] ?? [];
  }, [catalogState.data, selectedCategory]);

  useEffect(() => {
    setSelectedEquipmentType(equipmentOptionsForCategory[0]?.equipment_type ?? "");
  }, [equipmentOptionsForCategory]);

  const currentSelectedEquipment = equipmentOptionsForCategory.find((eq) => eq.equipment_type === selectedEquipmentType);

  const handleHouseChange = (key: keyof HouseInput, value: any) => {
    setHouse((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const zip = house.zip_code;
    if (!zip || zip.length < 2) {
      setClimateZone(null);
      setClimateError(null);
      return;
    }
    setClimateLoading(true);
    api
      .getClimateZone(zip)
      .then((resp) => {
        setClimateZone(resp.climate_zone);
        setClimateError(null);
      })
      .catch((err) => {
        setClimateZone(null);
        setClimateError((err as Error).message);
      })
      .finally(() => setClimateLoading(false));
  }, [house.zip_code]);

  const handleAddEquipment = () => {
    if (!selectedCategory || !selectedEquipmentType) return;
    const count = currentSelectedEquipment?.consumption_unit === "number_equipement" ? equipmentCount || 1 : 1;
    const newItem: SelectedEquipment = {
      equipment_category: selectedCategory,
      equipment_type: selectedEquipmentType,
      number_equipement: count
    };
    setSelectedEquipments((prev) => [...prev, newItem]);
    setEquipmentCount(1);
  };

  const handleRemoveEquipment = (index: number) => {
    setSelectedEquipments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSimulate = async () => {
    setSimulationState({ loading: true });
    try {
      const payload = {
        house: { ...house, annual_consumption_kWh: house.annual_consumption },
        selectedEquipments
      };
      const data = await api.runSimulation(payload);
      setSimulationState({ data, loading: false });
    } catch (error) {
      setSimulationState({ loading: false, error: (error as Error).message });
    }
  };

  const handleOpenConfig = async () => {
    setActiveTab("config");
    setConfigData((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const [equipements, tableday] = await Promise.all([api.getEquipementDescription(), api.getTableday()]);
      setConfigData({ equipements, tableday, loading: false });
    } catch (error) {
      setConfigData({ loading: false, error: (error as Error).message });
    }
  };

  return (
    <main className="app-shell">
      <section className="card">
        <header className="card-header">
          <div>
            <p className="eyebrow">Energy Sim</p>
            <h1>Simulation de consommation</h1>
          </div>
        </header>

        <div className="tabs">
          <div className="tab-group">
            <button className={activeTab === "form" ? "tab active" : "tab"} onClick={() => setActiveTab("form")}>
              Saisie
            </button>
            <button className={activeTab === "viz" ? "tab active" : "tab"} onClick={() => setActiveTab("viz")} disabled={!simulationState.data}>
              Consommations
            </button>
            <button className={activeTab === "solar" ? "tab active" : "tab"} onClick={() => setActiveTab("solar")} disabled={!simulationState.data}>
              Conso en journée
            </button>
            <button className={activeTab === "config" ? "tab active" : "tab"} onClick={() => handleOpenConfig()}>
              Config
            </button>
          </div>
          {simulationState.data && (
            <span className="badge">Consommation annuelle : {simulationState.data.total.annual} kWh</span>
          )}
          <div className="tab-actions">
            <button className="btn btn-orange" onClick={handleSimulate} disabled={simulationState.loading || catalogState.loading}>
              {simulationState.loading ? "Simulation..." : "Simuler"}
            </button>
            {simulationState.error && <span className="error">Erreur: {simulationState.error}</span>}
          </div>
        </div>

        {activeTab === "form" && (
          <>
            <div className="grid two">
              <div className="panel">
                <h2>Maison</h2>
                <HouseForm house={house} onChange={handleHouseChange} climateZone={climateZone} climateLoading={climateLoading} climateError={climateError} />
              </div>

              <div className="panel">
                <h2>Équipements</h2>
                {catalogState.loading && <p>Chargement du catalogue...</p>}
                {catalogState.error && <p className="error">Erreur: {catalogState.error}</p>}
                {catalogState.data && (
                  <>
                    <EquipmentSelector
                      categories={catalogState.data.categories}
                      equipmentByCategory={catalogState.data.equipmentByCategory}
                      selectedCategory={selectedCategory}
                      onCategoryChange={setSelectedCategory}
                      selectedEquipmentType={selectedEquipmentType}
                      onEquipmentChange={setSelectedEquipmentType}
                      onAdd={handleAddEquipment}
                      currentEquipment={currentSelectedEquipment}
                      equipmentCount={equipmentCount}
                      setEquipmentCount={setEquipmentCount}
                    />
                    <SelectedEquipmentsList items={selectedEquipments} onRemove={handleRemoveEquipment} />
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === "viz" && (
          <div className="stack results">
            {!simulationState.data && <p className="muted">Lancez une simulation pour visualiser les consommations.</p>}
            {simulationState.data && (
              <>
                <VisualizationSection sim={simulationState.data} />
                <ResultsView
                  houseMonthly={simulationState.data.houseMonthly}
                  houseMonthlySimulated={simulationState.data.houseMonthlySimulated}
                  coefficient={simulationState.data.coefficient}
                  annualSimulated={simulationState.data.annual_consumption_simulated}
                  categories={simulationState.data.consumptionByCategory}
                  total={simulationState.data.total}
                  equipments={simulationState.data.equipments}
                />
              </>
            )}
          </div>
        )}
        {activeTab === "solar" && (
          <div className="stack results">
            {!simulationState.data && <p className="muted">Lancez une simulation pour visualiser les consommations.</p>}
            {simulationState.data && <SolarSection sim={simulationState.data} />}
          </div>
        )}
        {activeTab === "config" && (
          <div className="stack results">
            <ConfigSection data={configData} />
          </div>
        )}
      </section>
    </main>
  );
}

type HouseFormProps = {
  house: HouseInput;
  onChange: (key: keyof HouseInput, value: any) => void;
  climateZone: Climate | null;
  climateLoading: boolean;
  climateError: string | null;
};

function HouseForm({ house, onChange, climateZone, climateLoading, climateError }: HouseFormProps) {
  return (
    <div className="form-grid">
      <label>
        Conso annuelle (kWh)
        <input type="number" value={house.annual_consumption} onChange={(e) => onChange("annual_consumption", Number(e.target.value))} />
      </label>
      <label>
        Surface (m²)
        <input type="number" value={house.surface} onChange={(e) => onChange("surface", Number(e.target.value))} />
      </label>
      <label>
        Nb personnes
        <input type="number" value={house.number_person} onChange={(e) => onChange("number_person", Number(e.target.value))} />
      </label>
      <label>
        Volume piscine (m³)
        <input type="number" value={house.pool_volume} onChange={(e) => onChange("pool_volume", Number(e.target.value))} />
      </label>
      <label>
        Zone climatique
        <input type="text" value={climateZone ? climateZone : "—"} readOnly />
        {climateLoading && <span className="muted">Calcul...</span>}
        {climateError && <span className="error">{climateError}</span>}
      </label>
      <label>
        Code postal
        <input type="text" value={house.zip_code} onChange={(e) => onChange("zip_code", e.target.value)} />
      </label>
      <label>
        Présence
        <select
          value={house.presence}
          onChange={(e) => onChange("presence", (e.target.value === "TT5j/Retraité" ? "TT5j_Retraite" : e.target.value) as HouseInput["presence"])}
        >
          {[
            { label: "Actif", value: "Actif" },
            { label: "TT1j", value: "TT1j" },
            { label: "TT2j", value: "TT2j" },
            { label: "TT3j", value: "TT3j" },
            { label: "TT4j", value: "TT4j" },
            { label: "TT5j/Retraité", value: "TT5j_Retraite" }
          ].map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={house.water_heater_during_day}
          onChange={(e) => onChange("water_heater_during_day", e.target.checked)}
        />
        Chauffe-eau en journée
      </label>
    </div>
  );
}

type EquipmentSelectorProps = {
  categories: string[];
  equipmentByCategory: Record<string, CatalogEquipment[]>;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  selectedEquipmentType: string;
  onEquipmentChange: (t: string) => void;
  onAdd: () => void;
  currentEquipment?: CatalogEquipment;
  equipmentCount: number;
  setEquipmentCount: (n: number) => void;
};

function EquipmentSelector({
  categories,
  equipmentByCategory,
  selectedCategory,
  onCategoryChange,
  selectedEquipmentType,
  onEquipmentChange,
  onAdd,
  currentEquipment,
  equipmentCount,
  setEquipmentCount
}: EquipmentSelectorProps) {
  return (
    <div className="stack">
      <div className="form-inline">
        <label>
          Catégorie
          <select value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
        <label>
          Équipement
          <select value={selectedEquipmentType} onChange={(e) => onEquipmentChange(e.target.value)}>
            {(equipmentByCategory[selectedCategory] ?? []).map((eq) => (
              <option key={eq.equipment_type} value={eq.equipment_type}>
                {eq.label}
              </option>
            ))}
          </select>
        </label>
        {currentEquipment?.consumption_unit === "number_equipement" && (
          <label>
            Nombre
            <input type="number" min={1} value={equipmentCount} onChange={(e) => setEquipmentCount(Number(e.target.value) || 1)} />
          </label>
        )}
        <button type="button" className="btn secondary" onClick={onAdd}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

type SelectedEquipmentsListProps = {
  items: SelectedEquipment[];
  onRemove: (index: number) => void;
};

function SelectedEquipmentsList({ items, onRemove }: SelectedEquipmentsListProps) {
  if (items.length === 0) {
    return <p className="muted">Aucun équipement ajouté.</p>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Catégorie</th>
          <th>Type</th>
          <th>Nombre</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={`${item.equipment_category}-${item.equipment_type}-${idx}`}>
            <td>{item.equipment_category}</td>
            <td>{item.equipment_type}</td>
            <td>{item.number_equipement}</td>
            <td>
              <button className="link" onClick={() => onRemove(idx)}>
                Supprimer
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type ResultsViewProps = {
  houseMonthly: Monthly;
  houseMonthlySimulated: Monthly;
  coefficient: number;
  annualSimulated: number;
  categories: SimulationResponse["consumptionByCategory"];
  total: SimulationResponse["total"];
  equipments: SimulationResponse["equipments"];
};

function ResultsView({ houseMonthly, houseMonthlySimulated, coefficient, annualSimulated, categories, total, equipments }: ResultsViewProps) {
  return (
    <div className="stack results">
      <div className="panel">
        <h3>Maison (au réel)</h3>
        <MonthlyTable monthly={houseMonthly} />
        <div className="muted">Coef. de recalage: {coefficient.toFixed(3)} | Conso simulée: {annualSimulated} kWh</div>
      </div>

      <div className="panel">
        <h3>Maison (simulée)</h3>
        <MonthlyTable monthly={houseMonthlySimulated} />
      </div>

      <div className="panel">
        <h3>Par catégorie (réel)</h3>
        <CategoryTable categories={categories} />
        <div className="muted">Total annuel: {total.annual} kWh</div>
      </div>

      <div className="panel">
        <h3>Détail par équipement</h3>
        {equipments.map((eq) => (
          <div key={eq.equipment.id} className="equipment-block">
            <div className="equipment-header">
              <div>
                <strong>{eq.equipment.label}</strong>
                <p className="muted">
                  {eq.equipment.equipment_category} • {eq.equipment.equipment_type} • {eq.equipment.consumption} kWh/an
                </p>
              </div>
            </div>
            <MonthlyTable monthly={eq.monthly} />
          </div>
        ))}
      </div>
    </div>
  );
}

type MonthlyTableProps = {
  monthly: Monthly;
};

function MonthlyTable({ monthly }: MonthlyTableProps) {
  const entries = Object.entries(monthly);
  return (
    <table className="table compact">
      <thead>
        <tr>
          {entries.map(([month]) => (
            <th key={month}>{month}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {entries.map(([month, value]) => (
            <td key={month}>{value}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

type CategoryTableProps = {
  categories: SimulationResponse["consumptionByCategory"];
};

function CategoryTable({ categories }: CategoryTableProps) {
  const rows = Object.entries(categories);
  if (rows.length === 0) return <p className="muted">Aucune donnée.</p>;
  return (
    <table className="table compact">
      <thead>
        <tr>
          <th>Catégorie</th>
          <th>Jan</th>
          <th>Feb</th>
          <th>Mar</th>
          <th>Apr</th>
          <th>May</th>
          <th>Jun</th>
          <th>Jul</th>
          <th>Aug</th>
          <th>Sep</th>
          <th>Oct</th>
          <th>Nov</th>
          <th>Dec</th>
          <th>Annuel</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([cat, data]) => (
          <tr key={cat}>
            <td>{cat}</td>
            <td>{data.monthly.january}</td>
            <td>{data.monthly.february}</td>
            <td>{data.monthly.march}</td>
            <td>{data.monthly.april}</td>
            <td>{data.monthly.may}</td>
            <td>{data.monthly.june}</td>
            <td>{data.monthly.july}</td>
            <td>{data.monthly.august}</td>
            <td>{data.monthly.septembre}</td>
            <td>{data.monthly.october}</td>
            <td>{data.monthly.november}</td>
            <td>{data.monthly.december}</td>
            <td>{data.annual}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type VisualizationSectionProps = {
  sim: SimulationResponse;
};

function VisualizationSection({ sim }: VisualizationSectionProps) {
  const barData = stackedMonthlyData(sim.consumptionByCategory);
  const categoryKeys = Object.keys(sim.consumptionByCategory);
  const pieData = categoryPieData(sim.consumptionByCategory, sim.total.annual);
  const hasCategories = categoryKeys.length > 0;

  return (
    <div className="grid two">
      <div className="panel">
        <h3>Consommation mensuelle (réelle)</h3>
        {!hasCategories && <p className="muted">Aucune donnée catégorie.</p>}
        {hasCategories && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<StackedTooltip />} />
              {categoryKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="monthly"
                  fill={pieColors[index % pieColors.length]}
                  name={key}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel">
        <h3>Consommation annuelle par catégorie (réelle)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {pieData.map((entry, index) => (
                <Cell key={`cell-${entry.name}`} fill={pieColors[index % pieColors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name, entry: any) => {
                const pct = entry.payload.percentage.toFixed(1);
                return [`${value} kWh (${pct}%)`, entry.payload.name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type SolarSectionProps = {
  sim: SimulationResponse;
};

function SolarSection({ sim }: SolarSectionProps) {
  const barData = solarStackedData(sim.houseMonthly, sim.houseMonthlySolar);
  const annualTotal = sim.total.annual;
  const annualSolar = sim.annual_consumption_solar;
  const pct = annualTotal === 0 ? 0 : (annualSolar / annualTotal) * 100;

  return (
    <div className="stack">
      <div className="grid two">
        <div className="panel">
          <h3>Consommation mensuelle (total vs heures solaires)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<SolarTooltip />} />
              <Bar dataKey="solar" stackId="s" fill="#f59e0b" name="Solaire" isAnimationActive={false} />
              <Bar dataKey="nonSolar" stackId="s" fill="#2563eb" name="Total hors solaire" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <h3>Indicateur annuel</h3>
          <p className="muted">Total annuel : {annualTotal} kWh</p>
          <p className="muted">Dont en heures solaires : {annualSolar} kWh</p>
          <h2>{pct.toFixed(1)}% couvert pendant les heures solaires</h2>
        </div>
      </div>
      <div className="panel">
        <h3>Tableau mensuel solaire</h3>
        <MonthlyTable monthly={sim.houseMonthlySolar} />
        <div className="muted">Annuel solaire : {annualSolar} kWh</div>
      </div>
    </div>
  );
}

type ConfigSectionProps = {
  data: {
    equipements?: EquipementDescriptionEntry[];
    tableday?: TabledayEntry[];
    loading: boolean;
    error?: string;
  };
};

function ConfigSection({ data }: ConfigSectionProps) {
  if (data.loading) return <p>Chargement de la configuration...</p>;
  if (data.error) return <p className="error">{data.error}</p>;
  return (
    <div className="stack">
      <div className="panel">
        <h3>equipement_description</h3>
        {data.equipements ? <EquipementTable rows={data.equipements} /> : <p className="muted">Aucune donnée.</p>}
      </div>
      <div className="panel">
        <h3>tableday_bycategory</h3>
        {data.tableday ? <TabledayTable rows={data.tableday} /> : <p className="muted">Aucune donnée.</p>}
      </div>
    </div>
  );
}

function EquipementTable({ rows }: { rows: EquipementDescriptionEntry[] }) {
  return (
    <div className="table-wrapper">
      <table className="table compact">
        <thead>
          <tr>
            <th>equipment_category</th>
            <th>equipment_type</th>
            <th>label</th>
            <th>tableday_bycategory</th>
            <th>consumption_unit</th>
            <th>equipment_energy_label</th>
            <th>consumption</th>
            <th>presence_sensitive</th>
            <th>isolation_sensitive</th>
            <th>energybox_sensitive</th>
            <th>solarhours_perday_percent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td>{row.equipment_category}</td>
              <td>{row.equipment_type}</td>
              <td>{row.label}</td>
              <td>{row.tableday_bycategory}</td>
              <td>{row.consumption_unit}</td>
              <td>{row.equipment_energy_label}</td>
              <td>{row.consumption}</td>
              <td>{String(row.presence_sensitive)}</td>
              <td>{String(row.isolation_sensitive)}</td>
              <td>{String(row.energybox_sensitive)}</td>
              <td>{row.solarhours_perday_percent ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabledayTable({ rows }: { rows: TabledayEntry[] }) {
  return (
    <div className="table-wrapper">
      <table className="table compact">
        <thead>
          <tr>
            <th>category</th>
            <th>month</th>
            <th>H1_days</th>
            <th>H2_days</th>
            <th>H3_days</th>
            <th>H1</th>
            <th>H2</th>
            <th>H3</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td>{row.category}</td>
              <td>{row.month}</td>
              <td>{row.H1_days}</td>
              <td>{row.H2_days}</td>
              <td>{row.H3_days}</td>
              <td>{row.H1}</td>
              <td>{row.H2}</td>
              <td>{row.H3}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const monthsOrdered: Array<keyof Monthly> = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "septembre",
  "october",
  "november",
  "december"
];

const monthLabels: Record<keyof Monthly, string> = {
  january: "Jan",
  february: "Feb",
  march: "Mar",
  april: "Apr",
  may: "May",
  june: "Jun",
  july: "Jul",
  august: "Aug",
  septembre: "Sep",
  october: "Oct",
  november: "Nov",
  december: "Dec"
};

function monthlyToChart(monthly: Monthly) {
  return monthsOrdered.map((m) => ({ month: monthLabels[m], value: monthly[m] }));
}

const pieColors = ["#2563eb", "#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];

function stackedMonthlyData(categories: SimulationResponse["consumptionByCategory"]) {
  const base = monthsOrdered.map((m) => {
    const row: Record<string, string | number> = { month: monthLabels[m] };
    for (const [cat, data] of Object.entries(categories)) {
      row[cat] = data.monthly[m];
    }
    return row;
  });
  return base;
}

function categoryPieData(
  categories: SimulationResponse["consumptionByCategory"],
  totalAnnual: number
): Array<{ name: string; value: number; percentage: number }> {
  if (!totalAnnual || totalAnnual === 0) {
    return Object.keys(categories).map((cat) => ({ name: cat, value: 0, percentage: 0 }));
  }
  return Object.entries(categories).map(([name, data]) => ({
    name,
    value: data.annual,
    percentage: (data.annual / totalAnnual) * 100
  }));
}

function solarStackedData(totalMonthly: Monthly, solarMonthly: SimulationResponse["houseMonthlySolar"]) {
  return monthsOrdered.map((m) => ({
    month: monthLabels[m],
    solar: solarMonthly[m],
    nonSolar: totalMonthly[m] - solarMonthly[m] < 0 ? 0 : totalMonthly[m] - solarMonthly[m]
  }));
}

type StackedTooltipProps = {
  active?: boolean;
  payload?: any[];
  label?: string;
};

function StackedTooltip({ active, payload, label }: StackedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload
    .filter((p) => p.value && p.value !== 0)
    .map((p) => ({
      name: p.name as string,
      value: p.value as number,
      color: (p.color as string) || (p.fill as string)
    }));
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="tooltip">
      <div className="tooltip-label">{label}</div>
      {items.map((item) => (
        <div key={item.name} className="tooltip-row">
          <span className="dot" style={{ background: item.color }}></span>
          <span>{item.name}</span>
          <span>{item.value} kWh</span>
        </div>
      ))}
      <div className="tooltip-row total">
        <span>Total</span>
        <span>{total} kWh</span>
      </div>
    </div>
  );
}

type SolarTooltipProps = StackedTooltipProps;

function SolarTooltip({ active, payload, label }: SolarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum, p) => sum + (p.value as number), 0);
  const solarEntry = payload.find((p) => p.dataKey === "solar");
  const solarValue = solarEntry ? (solarEntry.value as number) : 0;
  const pct = total === 0 ? 0 : (solarValue / total) * 100;
  return (
    <div className="tooltip">
      <div className="tooltip-label">{label}</div>
      <div className="tooltip-row">
        <span>Solaire</span>
        <span>{solarValue} kWh</span>
      </div>
      <div className="tooltip-row">
        <span>Total</span>
        <span>{total} kWh</span>
      </div>
      <div className="tooltip-row total">
        <span>Part solaire</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export default App;
