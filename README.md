Este projeto foi escrito 95% pelo Codex I.A. 
Estava curioso para criar algo com a I.A e enfrentava algumas dificuldades para buildar times competitivos principalmente no RadicalRed, então acabei entrando de cabeça nisso, perdendo alguns dias, tokens e por ai vai.
Foi extremamente interessante descobrir como podemos chegar longe com a I.A mesmo tendo apenas um conhecimento básico de lógica de programação.

**Todo o projeto está hospedado em serviços Free, então divirtam-se.**

# Equinox Beta v1.0.1

Equinox é um team builder competitivo e scenario-aware de Pokémon. A versão 1.0 combina análise de sinergia, ameaças, matchups qualitativos, AI Builder, cache inteligente, escopo por formato e auditoria de data packs.

## Requisitos

- Node.js compatível com o projeto
- MongoDB acessível pela variável `MONGO_URI`
- Backend e frontend configurados com os arquivos `.env.example`

## Execução local

```bash
npm install
npm --prefix frontend install
npm run dev
```

Em outro terminal:

```bash
npm --prefix frontend run dev
```

Por padrão:

- API: `http://localhost:3000`
- Frontend: `http://localhost:5173`

## Variáveis principais

Backend `.env`:

```env
APP_VERSION=1.0.1
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/pokemon_teambuilder
CORS_ORIGIN=*
JSON_LIMIT=1mb
EQUINOX_RECOMMENDATION_CACHE_TTL_MS=900000
EQUINOX_RECOMMENDATION_CACHE_MAX_ENTRIES=100
```

Frontend `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Checks de release

```bash
npm run typecheck
npm run data:check
npm run format:check
npm run release:check
```

## Publicacao gratuita

O projeto esta preparado para uma publicacao gratuita usando:

- Frontend: GitHub Pages
- API: Render Free Web Service
- Banco: MongoDB Atlas M0

### API no Render

O arquivo `render.yaml` define o servico `equinox-api`. No Render, use **New > Blueprint**, conecte este repositorio e informe a variavel obrigatoria:

```env
MONGO_URI=mongodb+srv://...
```

O blueprint ja configura:

```env
NODE_ENV=production
CORS_ORIGIN=https://thihrq.github.io
```

A URL esperada da API e:

```txt
https://equinox-api-c7zy.onrender.com
```

Se o Render gerar outra URL, configure no GitHub em **Settings > Secrets and variables > Actions > Variables**:

```env
VITE_API_BASE_URL=https://equinox-api-c7zy.onrender.com
```

Depois rode novamente o workflow **Deploy frontend** em **Actions**.

Endpoints úteis:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/ready
Invoke-RestMethod http://localhost:3000/api/system/status
Invoke-RestMethod http://localhost:3000/api/system/data-packs
Invoke-RestMethod http://localhost:3000/api/system/format-scope
Invoke-RestMethod http://localhost:3000/api/system/release
```

## Formatos suportados

- Vanilla por jogo oficial, com pools bootstrap/estritos por geração quando disponíveis.
- Competitivo/National Dex como meta ladder.
- Radical Red como Hardcore Boss Gauntlet, não como meta genérico.
- Pokémon Champions Singles/Doubles por Regulation Profile e Meta Source Pack.

## Observações de dados

Alguns formatos vivos possuem fontes marcadas como `pending` ou `bootstrap`, como Legends Z-A e o roster completo de Pokémon Champions. Isso é esperado e aparece nos painéis de fontes/freshness para evitar falsa confiança.
