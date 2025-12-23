import { useEffect, useMemo, useState } from "react";
import {
  api,
  CatalogEquipment,
  CatalogResponse,
  Climate,
  HouseInput,
  Monthly,
  SelectedEquipment,
  SimulationResponse
} from "./api/client";
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
  const [selectedEquipments, setSelectedEquipments] = useState<SelectedEquipment[]>([]);
  const [simulationState, setSimulationState] = useState<SimulationState>({ loading: false });
  const [climateZone, setClimateZone] = useState<Climate | null>(null);
  const [climateLoading, setClimateLoading] = useState(false);
  const [climateError, setClimateError] = useState<string | null>(null);

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

  return (
    <main className="app-shell">
      <section className="card">
        <header className="card-header">
          <div>
            <p className="eyebrow">Energy Sim</p>
            <h1>Simulation de consommation</h1>
          </div>
          <span className="badge">React + Vite</span>
        </header>

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

        <div className="actions">
          <button className="btn" onClick={handleSimulate} disabled={simulationState.loading || catalogState.loading}>
            {simulationState.loading ? "Simulation..." : "Simuler"}
          </button>
          {simulationState.error && <span className="error">Erreur: {simulationState.error}</span>}
        </div>

        {simulationState.data && (
          <ResultsView
            houseMonthly={simulationState.data.houseMonthly}
            houseMonthlySimulated={simulationState.data.houseMonthlySimulated}
            coefficient={simulationState.data.coefficient}
            annualSimulated={simulationState.data.annual_consumption_simulated}
            categories={simulationState.data.consumptionByCategory}
            total={simulationState.data.total}
            equipments={simulationState.data.equipments}
          />
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
        <h3>Maison (recalé)</h3>
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

export default App;
