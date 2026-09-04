-- Tabla para el panel de "Novedades y promociones" (ícono de regalo del header)
create table if not exists novedades (
    id bigint generated always as identity primary key,
    titulo text not null,
    categoria text default 'Novedad',
    imagen_url text not null,
    descripcion text,
    pasos jsonb,              -- opcional: array de strings, ej: ["Paso 1...", "Paso 2..."]
    orden int default 0,
    activo boolean default true,
    creado_at timestamptz default now()
);

alter table novedades enable row level security;

-- Cualquiera que esté logueado puede leer las novedades activas
create policy "novedades_select" on novedades
    for select
    using (true);

-- Ejemplo de cómo cargar una novedad (podés hacerlo desde el Table Editor de Supabase
-- sin necesidad de SQL, simplemente insertando una fila nueva):
-- insert into novedades (titulo, categoria, imagen_url, descripcion, pasos, orden)
-- values (
--   'Código CONFIA',
--   'Bono',
--   'https://tu-imagen.com/banner.jpg',
--   'Canjeá el código y llevate crédito de bono para jugar.',
--   '["Entrá a Promociones", "Pegá el código en Bono disponible", "Jugá con tu saldo de bono"]',
--   1
-- );
