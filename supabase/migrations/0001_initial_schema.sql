-- ============================================================
-- aistudio.mn — initial schema
-- ============================================================

-- Enums
create type public.order_status as enum ('pending','paid','processing','completed','failed');
create type public.generation_status as enum ('queued','processing','done','failed');
create type public.payment_provider as enum ('qpay','card');
create type public.payment_status as enum ('pending','success','failed');

-- ============================================================
-- users (extends auth.users)
-- ============================================================
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  phone       text not null unique,
  name        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: owner read/write"
  on public.users for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- categories (public read, admin write)
-- ============================================================
create table public.categories (
  id              text primary key,
  name_mn         text not null,
  name_en         text not null,
  description_mn  text not null,
  description_en  text not null,
  icon            text not null,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories: public read"
  on public.categories for select
  using (true);

-- ============================================================
-- presets (public read, admin write)
-- ============================================================
create table public.presets (
  id               text primary key,
  category_id      text not null references public.categories(id) on delete cascade,
  name_mn          text not null,
  name_en          text not null,
  output_ratio     text not null,
  steps            int  not null,
  price_mnt        int  not null,
  eta_min          text not null,
  warnings_mn      text[] not null default '{}',
  internal_prompt  text not null,   -- NEVER exposed to the client
  example_output   text not null,
  example_inputs   text[] not null default '{}',
  options          jsonb,
  required_uploads text[],
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.presets enable row level security;

create policy "presets: public read (no internal_prompt)"
  on public.presets for select
  using (true);

-- View that strips internal_prompt for client use.
-- security_invoker = true ensures the querying user's RLS policies apply,
-- not the view creator's (prevents SECURITY DEFINER bypass).
create view public.presets_public
  with (security_invoker = true)
as
  select
    id, category_id, name_mn, name_en, output_ratio, steps,
    price_mnt, eta_min, warnings_mn, example_output, example_inputs,
    options, required_uploads, sort_order, created_at
  from public.presets;

-- ============================================================
-- orders
-- ============================================================
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  preset_id        text not null references public.presets(id),
  status           public.order_status not null default 'pending',
  amount_mnt       int  not null,
  options_snapshot jsonb,           -- ratio, bg, intensity etc. at time of order
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "orders: owner read"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "orders: owner insert"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- payments
-- ============================================================
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  provider          public.payment_provider not null,
  qpay_invoice_id   text,
  status            public.payment_status not null default 'pending',
  amount_mnt        int  not null,
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "payments: owner read"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "payments: owner insert"
  on public.payments for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- generations
-- ============================================================
create table public.generations (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  status         public.generation_status not null default 'queued',
  progress       int  not null default 0 check (progress between 0 and 100),
  result_urls    text[],
  error          text,
  queue_position int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.generations enable row level security;

create policy "generations: owner read"
  on public.generations for select
  using (auth.uid() = user_id);

-- ============================================================
-- assets (gallery)
-- ============================================================
create table public.assets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  generation_id  uuid references public.generations(id) on delete set null,
  storage_path   text not null,
  is_private     boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table public.assets enable row level security;

create policy "assets: owner read"
  on public.assets for select
  using (auth.uid() = user_id);

create policy "assets: owner insert"
  on public.assets for insert
  with check (auth.uid() = user_id);

create policy "assets: owner update"
  on public.assets for update
  using (auth.uid() = user_id);

create policy "assets: owner delete"
  on public.assets for delete
  using (auth.uid() = user_id);

-- ============================================================
-- auto-update updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_users
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger set_updated_at_orders
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger set_updated_at_generations
  before update on public.generations
  for each row execute function public.set_updated_at();

-- ============================================================
-- Seed: categories & presets from data.ts
-- ============================================================
insert into public.categories (id, name_mn, name_en, description_mn, description_en, icon, sort_order) values
  ('cat-family',      'Гэр бүлийн зураг',       'Family Photos',           'Гэр бүл, найзуудтайгаа бодит мэт хамт зураг бүтээх.', 'Create realistic photos with family and friends.',   '👨‍👩‍👧‍👦', 1),
  ('cat-restoration', 'Хуучин зураг сэргээх',   'Old Photo Restoration',   'Шаргалтсан, бүдгэрсэн, урагдсан зургийг сайжруулах.', 'Fix yellowed, faded, torn photos.',                  '🖼️', 2),
  ('cat-bg',          'Фон солих',               'Background Replacement',  'Зургийн арын фоныг мэргэжлийн байдлаар солих.',        'Replace backgrounds professionally.',                '🎨', 3),
  ('cat-portrait',    'Портрет сайжруулах',      'Portrait Enhancement',    'Царай, арьсны өнгийг мэргэжлийн зургийн чанарт хүргэх.', 'Enhance face and skin to professional photo quality.', '✨', 4);

insert into public.presets (id, category_id, name_mn, name_en, output_ratio, steps, price_mnt, eta_min, warnings_mn, internal_prompt, example_output, example_inputs, options, required_uploads, sort_order) values
  ('fam-3p',       'cat-family',      '3 хүн',                '3 people',            '4:3',      3, 3900, '1–3',   array['Царайны детал сайн гарсан зураг оруулна уу.','AI үр дүн 100% ижил биш.','Фон жишээтэй яг адилгүй байж болно.'], 'Three people sitting close together on a sofa, medium-tight shot, natural light; preserve each person''s identity and age; high quality, 4:3.', '/examples/family-out.jpg',  array['/examples/person1.jpg','/examples/person2.jpg','/examples/person3.jpg'], '{"backgroundPresets":["Studio","Family Room","Outdoor","Minimal"],"styleIntensityDefault":30}', array['1-р хүн','2-р хүн','3-р хүн'], 1),
  ('fam-2p',       'cat-family',      '2 хүн',                '2 people',            '4:3',      3, 2900, '1–2',   array['Царайны детал сайн гарсан зураг оруулна уу.','AI үр дүн 100% ижил биш.'],                                  'Two people together, natural light, warm atmosphere; preserve identities; high quality, 4:3.',                                               '/examples/family2-out.jpg', array['/examples/person1.jpg','/examples/person2.jpg'],                          '{"backgroundPresets":["Studio","Outdoor","Home","Minimal"],"styleIntensityDefault":30}',        array['1-р хүн','2-р хүн'],          2),
  ('rest-basic',   'cat-restoration', 'Суурь сэргээн засварлалт', 'Basic Restoration','Original', 2, 2500, '1–2',   array['Өндөр нягтаршилтай зураг илгээвэл үр дүн сайжирна.'],                                                        'Restore old photo: remove scratches/noise, recover details while keeping authenticity.',                                                    '/examples/rest-out.jpg',    array['/examples/old1.jpg'],                                                     null,                                                                                             array['Хуучин зураг'],               1),
  ('rest-color',   'cat-restoration', 'Өнгөт болгох',         'Colorize',            'Original', 2, 3500, '1–3',   array['Хар цагаан зураг оруулна уу.'],                                                                                'Colorize black and white photo realistically, natural skin tones and environment colors.',                                                  '/examples/color-out.jpg',   array['/examples/bw1.jpg'],                                                      null,                                                                                             array['Хар цагаан зураг'],           2),
  ('bg-id',        'cat-bg',          'Ажлын зураг (ID)',     'ID Photo Look',       '4:5',      2, 1900, '0.5–1', array['Мөрнөөс дээш харагдсан, царай тод гарсан зураг илгээнэ үү.'],                                                 'Professional ID photo: clean studio background, neutral lighting, formal look; preserve identity.',                                        '/examples/id-out.jpg',      array['/examples/selfie1.jpg'],                                                  '{"backgroundPresets":["Цагаан","Цэнхэр","Саарал","Кремэн"]}',                                   array['Зураг'],                      1),
  ('bg-studio',    'cat-bg',          'Студи фон',            'Studio Background',   '3:4',      2, 2500, '0.5–1', array['Тод, гэрэлтэй нөхцөлд дарсан зураг илгээнэ үү.'],                                                             'Professional studio background, clean lighting, portrait quality.',                                                                        '/examples/studio-out.jpg',  array['/examples/selfie2.jpg'],                                                  '{"backgroundPresets":["Gradient","Studio White","Dark","Colorful"]}',                            array['Зураг'],                      2),
  ('port-retouch', 'cat-portrait',    'Нүүр засварлалт',      'Face Retouch',        'Original', 2, 1900, '0.5–1', array['Царайны детал тод харагдах зураг оруулна уу.'],                                                                'Professional face retouch: smooth skin, even tone, preserve natural look.',                                                                 '/examples/retouch-out.jpg', array['/examples/portrait1.jpg'],                                                null,                                                                                             array['Портрет зураг'],              1);
