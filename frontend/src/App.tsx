import "./index.css";

function App() {
  return (
    <main className="app-shell">
      <section className="card">
        <p className="eyebrow">Energy Sim</p>
        <h1>Bienvenue 👋</h1>
        <p>
          Frontend React + Vite prêt. Connectez-le à l'API Express/Prisma pour
          afficher vos consommations.
        </p>
        <div className="actions">
          <a className="btn" href="http://localhost:4000/health" target="_blank" rel="noreferrer">
            Vérifier l&apos;API
          </a>
          <a className="link" href="https://vitejs.dev/guide/" target="_blank" rel="noreferrer">
            Docs Vite
          </a>
        </div>
      </section>
    </main>
  );
}

export default App;
