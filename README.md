# Energy Sim Monorepo

Monorepo fullstack pour simuler et suivre les consommations énergétiques d'équipements.

## Périmètre
- Frontend : React + Vite + TypeScript (`frontend/`).
- Backend : Node.js + Express + TypeScript + Prisma (`backend/`).
- Base de données : PostgreSQL.

## Démarrage rapide
0- Créer ma DB energy-sim dans Postgre
Si tu utilises Prisma, la base doit déjà exister avant :
psql -U postgres
note : postgres = utilisateur par défaut. Sans mot de passe
CREATE DATABASE energy_sim;
DATABASE_URL="postgresql://postgres:@localhost:5432/energy-sim?schema=public"

1. Installer les dépendances :
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
2. Configurer les variables d'environnement (voir `backend/.env.example`).
3. Générer le client Prisma : `npm run prisma:generate` dans `backend/`.
4. Lancer l'API en dev : `npm run dev` dans `backend/`.
5. Lancer le front en dev : `npm run dev` dans `frontend/`.

## Commandes GIT
Au depart :
git init
Verif : git status
git add .
git commit -m "Initial commit"

Ajouter le dépôt distant en htpps
git remote add origin https://github.com/TON_USER/TON_REPO.git
git remote add origin https://github.com/fredGooM/calcul_conso.git
Verif : git remote -v

git branch -M main
git push -u origin main

En rolling:
git add .
git commit -m "Description du changement"
git push

voir l'historique: git log --oneline

## Scripts utiles (backend)
- `npm run dev` : démarre le serveur en mode développement.
- `npm run build` : compile TypeScript.
- `npm run start` : démarre le serveur compilé.
- `npm run prisma:generate` : génère le client Prisma.
- `npm run prisma:migrate` : applique les migrations.


## Bash pour tester
curl -s http://localhost:4000/api/catalog | jq .

curl -s -X POST http://localhost:4000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "house": {
      "annual_consumption": 10000,
      "presence": "TT2j",
      "number_person": 4,
      "pool_volume": 40,
      "surface": 100,
      "dpe": "C",
      "climat_region": "H2",
      "zip_code": "34470",
      "water_heater_during_day": false
    },
    "selectedEquipments": [
      { "equipment_category": "chauffage", "equipment_type": "radiateur", "number_equipement": 1 },
           { "equipment_category": "climatisation", "equipment_type": "pac_airair", "number_equipement": 1 }, 
            { "equipment_category": "chauffe_eau", "equipment_type": "ecs_electrique", "number_equipement": 1 }, 
            { "equipment_category": "piscine", "equipment_type": "piscine", "number_equipement": 1 }, 
            { "equipment_category": "multimedia", "equipment_type": "box_Internet", "number_equipement": 2 }
    ]
  }' | jq .

