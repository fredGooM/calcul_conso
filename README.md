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
git push -u origin main

voir l'historique: git log --oneline

## Scripts utiles (backend)
- `npm run dev` : démarre le serveur en mode développement.
- `npm run build` : compile TypeScript.
- `npm run start` : démarre le serveur compilé.
- `npm run prisma:generate` : génère le client Prisma.
- `npm run prisma:migrate` : applique les migrations.

## Endpoints clés (backend)
- `GET /api/catalog`
- `POST /api/simulations` (payload maison + équipements, champ `annual_consumption_kWh`)
- `GET /house/:id/houseMonthly_simulated`
- `GET /house/:id/houseMonthly`


## Bash pour tester
curl -s http://localhost:4000/api/catalog | jq .

curl -s http://localhost:4000/api/tableday | jq .


curl -s -X POST http://localhost:4000/api/simulations \
  -H "Content-Type: application/json" \
  -d '{
    "house": {
      "annual_consumption_kWh": 10000,
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

  ## MaJ Prisma
# 1) Vérifier que Prisma comprend le schéma
npx prisma validate

# 2) (optionnel mais recommandé) Formater le schema.prisma
npx prisma format

Générer le client Prisma (obligatoire)
npx prisma generate

# 3) Créer et appliquer une migration + générer le client
npx prisma migrate dev --name init_switchgrid
npx prisma migrate dev --name add_switchgrid_ask_and_enedis_status

# 4) (optionnel) Ouvrir Prisma Studio pour vérifier les tables
npx prisma studio


## Bash pour tester route Switchgrid

curl -G "http://localhost:4001/api/enedis/search-contract" \
  --data-urlencode "name=Dupont" \
  --data-urlencode "address=10 rue de la paix 75002 Paris"

  curl -G "http://localhost:4001/api/enedis/search-contract" \
  --data-urlencode "name=Dupont" \
    --data-urlencode "address=10 rue de la paix 75002 Paris" \
  --data-urlencode "prm=00000000000022"


## Installation de Ngtok pour rendre visible le webhool local de l'exterieur
  brew install ngrok/ngrok/ngrok
  ngrok config add-authtoken 37LCC01W7KMwFTpddHOopC4Ligm_81xCcJLEtWWVh6sZJV12t
  ngrok http 4001
  https://unprovided-patricia-nonofficially.ngrok-free.dev

## Test du webhook Ask en local
curl -i -X POST "http://localhost:4001/api/enedis/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "_tag": "ask.accepted",
      "createdAt": "2025-12-25T10:00:00.000Z",
      "organizationId": "org_test",
      "askId": "ASK_TEST_001"
    }
  }'