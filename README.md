## Express + TypeScript backend (starter)

### Requirements
- **Node.js**: 20.x LTS (khuyến nghị). Nếu bạn thích mới hơn thì dùng 22.x LTS cũng ổn.
- **TypeScript**: 5.8+
- **ts-node**: 10.9+

### Setup

```bash
npm i
cp .env.example .env
```

### Run (dev)

```bash
npm run dev
```

Mặc định có endpoint:
- `GET /health` → `{ ok: true }`

### Build & run (prod-like)

```bash
npm run build
npm run start
```

