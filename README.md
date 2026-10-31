# Credirecto

Hackatón de PagoDirecto. **Credirecto** es el motor que decide, con cómo y cuándo paga cada usuario, a quién
habilitarle el crédito, cuántos tickets darle, qué comunicarle y cómo premiarlo.

```
hackaton/
├── CLAUDE.md      # guía del equipo: sistema visual, reglas de negocio y decisiones del back
├── API.md         # contrato JSON entre back y front
├── disenos/       # diseños de referencia (HTML exportados)
├── back/          # FastAPI + motor + datos sintéticos (Python 3.11+, Postgres)
└── front/         # React (Vite) + Recharts: dashboard Credirecto y app móvil de pruebas
```

## Correrlo en local

Necesitas Python 3.11+, Node 20+ y PostgreSQL (local o Supabase).

### 1. Base de datos

Crea una base vacía, por ejemplo en tu Postgres local:

```bash
psql -U postgres -c "create database ritmo"
```

### 2. Back

```bash
cd back
python -m venv .venv
.venv\Scripts\activate          # en macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # y pon tu DATABASE_URL (en macOS/Linux: cp)
python -m datos.generar         # crea las tablas y carga 500 usuarios (~40 s)
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest -q
```

### 3. Front

```bash
cd front
npm install
npm run dev                     # http://localhost:5173
```

- Dashboard: <http://localhost:5173/dashboard>
- App móvil de pruebas: <http://localhost:5173/app>

Si el back corre en otra dirección, crea `front/.env` con `VITE_API_URL=http://...`.
Con `VITE_MOCK=1` el front funciona sin back, con datos de ejemplo.

## Demo

- **u_0142 · María**: Confiable y Puntual. Hoy usó un ticket en C.C. El Tolón; puede mover la cuota a su
  quincena (15 nov) y, si paga antes, tiene 25 % de descuento en el gasto administrativo y suma a su racha.
- **u_0333 · Carmen**: aún sin Credirecto. Le falta verificar el vehículo y un pago de servicio a tiempo.
- **u_0007 · Pedro**: usó 2 tickets que vencen hoy y no paga. Con "Avanzar un día": días 1–2 gracia,
  día 3 comisión, día 8 mora → modo recuperación con débito de la wallet. Una recarga paga primero la deuda.
- "Avanzar un día" mueve también a los otros 497 usuarios (usan y pagan según su perfil).
  "Reiniciar demo" vuelve al 31 oct 2026.
