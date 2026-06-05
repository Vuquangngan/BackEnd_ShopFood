# Chay backend local va server

Codebase nay dung chung cho ca local va server. Khac nhau nam o bien moi truong.

## Local

1. Sao chep `.env.local.example` thanh `.env`.
2. Dien thong tin database local hoac `DATABASE_URL` neu muon dung Aiven tu may local.
3. Chay:

```bash
npm run start:local
```

Ghi chu:
- `start:local` mac dinh `NODE_ENV=development`.
- `DB_SYNC_ON_START=true` de Sequelize tu can schema khi phat trien local.
- Neu khong muon tu sync DB, dat `DB_SYNC_ON_START=false` trong `.env`.

## Server/Render

1. Lay bien tu `.env.server.example` dua vao Environment Variables tren Render.
2. Dat `DATABASE_URL` bang chuoi ket noi Aiven/Postgres.
3. Chay bang lenh mac dinh:

```bash
npm start
```

Hoac neu can ep production:

```bash
npm run start:server
```

Ghi chu:
- Production mac dinh khong `sequelize.sync({ alter: true })` de khoi dong nhanh va tranh doi schema ngoai y muon.
- Anh upload nen duoc luu qua API/upload va DB neu can giu sau moi lan deploy; thu muc local `uploads/` tren server mien phi co the bi mat khi instance rebuild.
