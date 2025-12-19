# TVZapão - Sorteio System

Sistema de sorteio com números 00-99, pagamento via Pix e janelas de 1 hora.

## 🚀 Deploy no Railway

### Variáveis de Ambiente Necessárias:

```bash
DATABASE_URL=postgresql://neondb_owner:npg_VLG3S4iwWfYC@ep-shy-queen-a4fk3uph-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

NODE_ENV=production
PORT=3000
PRIZE_BASE_AMOUNT=500.00

# Admin (tokens de segurança)
ADMIN_URL_TOKEN=painel-tvzapao-2024
SETUP_TOKEN=primeira-config-987654
SESSION_SECRET=tvzapao-session-secret-prod

# Mercado Pago (obter em developers.mercadopago.com)
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=

# Cloudflare Turnstile (obter em dash.cloudflare.com)
TURNSTILE_SECRET_KEY=

# Security
CORS_ORIGIN=https://tvzapao.com.br
RATE_LIMIT_MAX=1000
```

### Passos para Deploy:

1. **No Railway:**
   - Clique "+ New" → "GitHub Repo" (se já fez push)
   - OU "Projeto Vazio" para upload manual

2. **Configurar Variáveis:**
   - Aba "Variables"
   - Cole todas as variáveis acima

3. **Deploy:**
   - Railway detecta Node.js automaticamente
   - Roda `npm install` e `npm start`
   - Migrations executam automaticamente!

4. **Gerar Domínio:**
   - Settings → Networking → Generate Domain
   - Anote a URL gerada

## 📦 Estrutura

```
sorteio/
├── migrations/          # Database migrations
├── public/             # Frontend files
├── src/
│   ├── database/       # PostgreSQL connection
│   ├── jobs/           # Background jobs
│   ├── routes/         # API routes
│   └── services/       # Business logic
└── railway.json        # Railway config
```

## 🔧 Comandos

```bash
npm start          # Start server
npm run migrate    # Run migrations manually
```

## ✅ Features

- ✅ PostgreSQL (Neon)
- ✅ Draw system (1-hour windows)
- ✅ Hot numbers (🔥 badge)
- ✅ Purchase limit (3 per person)
- ✅ Sales lock mechanism
- ✅ Admin panel
- ⏳ Mercado Pago integration (pending credentials)
- ⏳ Cloudflare Turnstile (pending credentials)
