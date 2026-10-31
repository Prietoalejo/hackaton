-- Ritmo · esquema de base de datos. Se puede ejecutar varias veces: solo crea lo que falta.

create table if not exists reloj (
  id int primary key check (id = 1),
  fecha_actual date not null
);

create table if not exists usuarios (
  id text primary key,
  nombre text not null,
  alias text,
  fecha_registro date not null,
  cedula_verificada boolean not null default false,
  vehiculo_verificado boolean not null default false,
  saldo_wallet numeric(12,4) not null default 0,
  perfil_sintetico text,                 -- puntual | conductor | ocasional | moroso | sin_credito (solo para datos)
  quincenero boolean not null default false,   -- solo para datos: recarga y paga en su quincena
  canal_preferido text not null default 'push' check (canal_preferido in ('push','wisi')),
  club text,
  habilitado_desde date,                 -- null = en espera
  modo_recuperacion boolean not null default false   -- tiene un ticket en mora: solo puede recargar y pagar
);

create table if not exists eventos (
  id bigserial primary key,
  user_id text not null references usuarios(id),
  fecha date not null,
  tipo text not null check (tipo in
    ('pago_servicio','recarga','rechazo_fondos','uso_ticket','repago_ticket','comision','debito_wallet')),
  servicio text,
  monto numeric(12,2) not null default 0,
  ticket_id bigint,
  a_tiempo boolean                       -- solo para pagos con fecha límite
);

create table if not exists tickets (
  id bigserial primary key,
  user_id text not null references usuarios(id),
  servicio text not null,
  comercio text,
  monto numeric(12,2) not null,          -- lo que cubrió el crédito
  gasto_admin numeric(12,2) not null default 0,
  fecha_uso date not null,
  fecha_vencimiento date not null,
  fecha_pago date,
  estado text not null check (estado in
    ('abierto','gracia','atrasado','mora','pagado','disputa','pausa_tecnica')),
  comision numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  monto_pagado numeric(12,2) not null default 0,
  pago_planeado date                     -- solo para datos sintéticos: cuándo lo pagará el usuario
);

create table if not exists perfiles (
  user_id text primary key references usuarios(id),
  trust_score int not null,
  razones jsonb not null,
  habilitado boolean not null,
  nivel int check (nivel between 0 and 3),   -- null si no está habilitado
  segmento text not null,
  estado_mora text not null,
  quincena int[] not null,
  actualizado date not null
);

create table if not exists decisiones (
  id bigserial primary key,
  user_id text not null references usuarios(id),
  fecha date not null,
  prestar jsonb not null,
  comunicar jsonb not null,
  premiar jsonb not null
);

-- Una foto diaria del perfil: subidas y bajadas de nivel, score cayendo, habilitaciones
create table if not exists historial_niveles (
  user_id text not null references usuarios(id),
  fecha date not null,
  trust_score int not null,
  habilitado boolean not null,
  nivel int,
  segmento text not null,
  primary key (user_id, fecha)
);

-- Cada vez que alguien intenta pagar con Credirecto
create table if not exists solicitudes (
  id bigserial primary key,
  user_id text not null references usuarios(id),
  fecha date not null,
  servicio text not null,
  monto numeric(12,2) not null,
  resultado text not null check (resultado in ('aprobada','parcial','rechazada')),
  motivo text,
  ticket_id bigint
);

-- Métricas diarias del mundo contrafactual "regla actual" (mismos usuarios, 2 tickets, 7 días)
create table if not exists metricas_regla_actual (
  fecha date primary key,
  prestado numeric(12,2) not null,
  usos int not null,
  usos_reusados int not null,
  vencidos int not null,
  a_tiempo int not null,
  llegaron_a_mora int not null,
  comisiones numeric(12,2) not null,
  deuda_mora numeric(12,2) not null,
  habilitados int not null
);

create table if not exists bitacora (
  id bigserial primary key,
  fecha date not null,
  mensaje text not null
);

create table if not exists configuracion (
  id int primary key check (id = 1),
  valores jsonb not null,
  fecha date not null,
  por text not null
);

create index if not exists idx_eventos_user_fecha on eventos(user_id, fecha);
create index if not exists idx_tickets_user_estado on tickets(user_id, estado);
create index if not exists idx_tickets_vencimiento on tickets(fecha_vencimiento);
create index if not exists idx_decisiones_fecha on decisiones(fecha, user_id);
create index if not exists idx_solicitudes_fecha on solicitudes(fecha);
