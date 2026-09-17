-- GlobalTradeLab learning platform backend.
-- Clients never access these tables directly: authenticated Next.js routes use service_role.

create schema if not exists private;

create or replace function private.learning_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.learning_set_updated_at() from public, anon, authenticated;

create table public.learning_categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name jsonb not null check (jsonb_typeof(name) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  icon text not null default 'BookOpen',
  position integer not null default 0 check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_tags (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name jsonb not null check (jsonb_typeof(name) = 'object'),
  created_at timestamptz not null default now()
);

create table public.learning_courses (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  slug text not null unique,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  short_title jsonb not null default '{}'::jsonb check (jsonb_typeof(short_title) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  outcomes jsonb not null default '[]'::jsonb check (jsonb_typeof(outcomes) = 'array'),
  thumbnail_path text,
  category_id bigint not null references public.learning_categories(id) on delete restrict,
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_duration_minutes integer not null default 0 check (estimated_duration_minutes >= 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  author_id uuid references public.profiles(user_id) on delete set null,
  is_official boolean not null default false,
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(title ->> 'es', '') || ' ' || coalesce(title ->> 'en', '') || ' ' ||
      coalesce(description ->> 'es', '') || ' ' || coalesce(description ->> 'en', '')
    )
  ) stored
);

create table public.learning_course_tags (
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  tag_id bigint not null references public.learning_tags(id) on delete cascade,
  primary key (course_id, tag_id)
);

create table public.learning_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  external_key text not null,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  position integer not null check (position >= 0),
  status text not null default 'published' check (status in ('draft', 'review', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, external_key),
  unique (course_id, position)
);

create table public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.learning_course_modules(id) on delete cascade,
  external_key text not null,
  slug text not null,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  lesson_type text not null default 'lesson' check (lesson_type in ('lesson', 'video', 'practice', 'quiz', 'assessment', 'resource')),
  estimated_duration_minutes integer not null default 0 check (estimated_duration_minutes >= 0),
  position integer not null check (position >= 0),
  status text not null default 'published' check (status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  author_id uuid references public.profiles(user_id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, external_key),
  unique (module_id, slug),
  unique (module_id, position)
);

create table public.learning_lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  block_type text not null check (block_type in (
    'text', 'heading', 'lead', 'image', 'video', 'audio', 'pdf', 'file', 'table', 'formula',
    'code', 'note', 'warning', 'example', 'question', 'quiz', 'activity', 'practice', 'news', 'chart', 'glossary'
  )),
  position integer not null check (position >= 0),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, position)
);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  slug text not null unique,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  estimated_duration_minutes integer not null default 0 check (estimated_duration_minutes >= 0),
  icon text not null default 'Compass',
  offers_certificate boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  author_id uuid references public.profiles(user_id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_path_items (
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  position integer not null check (position >= 0),
  is_required boolean not null default true,
  primary key (path_id, course_id),
  unique (path_id, position)
);

create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.learning_lessons(id) on delete set null,
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  storage_bucket text not null default 'learning-resources',
  storage_path text not null unique,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  kind text not null check (kind in ('image', 'video', 'audio', 'pdf', 'document', 'spreadsheet', 'other')),
  status text not null default 'active' check (status in ('active', 'archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  quiz_type text not null default 'practice' check (quiz_type in ('practice', 'evaluation', 'final', 'class_activity')),
  passing_score numeric(5, 2) not null default 70 check (passing_score between 0 and 100),
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.learning_quizzes(id) on delete cascade,
  question_type text not null check (question_type in ('single_choice', 'multiple_choice', 'true_false', 'ordering', 'matching', 'open', 'case', 'simulation')),
  prompt jsonb not null check (jsonb_typeof(prompt) = 'object'),
  explanation jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  position integer not null check (position >= 0),
  points numeric(8, 2) not null default 1 check (points >= 0),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  unique (quiz_id, position)
);

create table public.learning_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.learning_questions(id) on delete cascade,
  label jsonb not null check (jsonb_typeof(label) = 'object'),
  position integer not null check (position >= 0),
  is_correct boolean not null default false,
  unique (question_id, position)
);

create table public.learning_user_progress (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  progress_percent numeric(5, 2) not null default 0 check (progress_percent between 0 and 100),
  last_lesson_id uuid references public.learning_lessons(id) on delete set null,
  time_spent_seconds bigint not null default 0 check (time_spent_seconds >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table public.learning_lesson_progress (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  time_spent_seconds bigint not null default 0 check (time_spent_seconds >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.learning_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.learning_quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  score numeric(5, 2) check (score between 0 and 100),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  unique (quiz_id, user_id, attempt_number)
);

create table public.learning_saved_content (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  content_type text not null check (content_type in ('course', 'path', 'lesson', 'resource')),
  content_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, content_type, content_id)
);

create table public.learning_assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  assigned_by uuid not null references public.profiles(user_id) on delete cascade,
  content_type text not null check (content_type in ('course', 'module', 'lesson', 'path', 'quiz')),
  content_id uuid not null,
  title text not null,
  instructions text not null default '',
  due_at timestamptz,
  score_points numeric(8, 2) check (score_points is null or score_points >= 0),
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_content_versions (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('course', 'module', 'lesson', 'path', 'quiz')),
  entity_id uuid not null,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, version_number)
);

create table public.learning_content_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  draft_key text not null,
  entity_type text not null check (entity_type in ('course', 'module', 'lesson', 'path', 'quiz', 'resource')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, draft_key)
);

-- Foreign keys and high-frequency access paths.
create index learning_courses_category_status_idx on public.learning_courses(category_id, status, published_at desc);
create index learning_courses_author_idx on public.learning_courses(author_id) where author_id is not null;
create index learning_courses_search_idx on public.learning_courses using gin(search_vector);
create index learning_course_tags_tag_idx on public.learning_course_tags(tag_id, course_id);
create index learning_modules_course_position_idx on public.learning_course_modules(course_id, position);
create index learning_lessons_module_position_idx on public.learning_lessons(module_id, position);
create index learning_lessons_author_idx on public.learning_lessons(author_id) where author_id is not null;
create index learning_blocks_lesson_position_idx on public.learning_lesson_blocks(lesson_id, position);
create index learning_paths_author_idx on public.learning_paths(author_id) where author_id is not null;
create index learning_path_items_course_idx on public.learning_path_items(course_id, path_id);
create index learning_resources_lesson_idx on public.learning_resources(lesson_id) where lesson_id is not null;
create index learning_resources_owner_created_idx on public.learning_resources(owner_id, created_at desc);
create index learning_quizzes_lesson_idx on public.learning_quizzes(lesson_id);
create index learning_questions_quiz_position_idx on public.learning_questions(quiz_id, position);
create index learning_question_options_question_position_idx on public.learning_question_options(question_id, position);
create index learning_user_progress_course_status_idx on public.learning_user_progress(course_id, status);
create index learning_user_progress_user_activity_idx on public.learning_user_progress(user_id, last_activity_at desc);
create index learning_lesson_progress_lesson_status_idx on public.learning_lesson_progress(lesson_id, status);
create index learning_quiz_attempts_user_started_idx on public.learning_quiz_attempts(user_id, started_at desc);
create index learning_saved_content_user_created_idx on public.learning_saved_content(user_id, created_at desc);
create index learning_assignments_room_due_idx on public.learning_assignments(room_id, due_at);
create index learning_assignments_assigned_by_idx on public.learning_assignments(assigned_by);
create index learning_versions_entity_idx on public.learning_content_versions(entity_type, entity_id, version_number desc);
create index learning_versions_created_by_idx on public.learning_content_versions(created_by) where created_by is not null;
create index learning_content_drafts_user_updated_idx on public.learning_content_drafts(user_id, updated_at desc);

-- Keep mutable records timestamped without relying on client clocks.
create trigger learning_categories_updated_at before update on public.learning_categories for each row execute function private.learning_set_updated_at();
create trigger learning_courses_updated_at before update on public.learning_courses for each row execute function private.learning_set_updated_at();
create trigger learning_modules_updated_at before update on public.learning_course_modules for each row execute function private.learning_set_updated_at();
create trigger learning_lessons_updated_at before update on public.learning_lessons for each row execute function private.learning_set_updated_at();
create trigger learning_blocks_updated_at before update on public.learning_lesson_blocks for each row execute function private.learning_set_updated_at();
create trigger learning_paths_updated_at before update on public.learning_paths for each row execute function private.learning_set_updated_at();
create trigger learning_resources_updated_at before update on public.learning_resources for each row execute function private.learning_set_updated_at();
create trigger learning_quizzes_updated_at before update on public.learning_quizzes for each row execute function private.learning_set_updated_at();
create trigger learning_user_progress_updated_at before update on public.learning_user_progress for each row execute function private.learning_set_updated_at();
create trigger learning_lesson_progress_updated_at before update on public.learning_lesson_progress for each row execute function private.learning_set_updated_at();
create trigger learning_assignments_updated_at before update on public.learning_assignments for each row execute function private.learning_set_updated_at();
create trigger learning_content_drafts_updated_at before update on public.learning_content_drafts for each row execute function private.learning_set_updated_at();

-- Defense in depth: only the trusted API can reach learning data.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'learning_categories', 'learning_tags', 'learning_courses', 'learning_course_tags',
    'learning_course_modules', 'learning_lessons', 'learning_lesson_blocks', 'learning_paths',
    'learning_path_items', 'learning_resources', 'learning_quizzes', 'learning_questions',
    'learning_question_options', 'learning_user_progress', 'learning_lesson_progress',
    'learning_quiz_attempts', 'learning_saved_content', 'learning_assignments', 'learning_content_versions',
    'learning_content_drafts'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end;
$$;

grant usage, select on all sequences in schema public to service_role;

-- Initial taxonomy and catalog. Runtime content is read from these rows, never from JSX.
insert into public.learning_categories(slug, name, icon, position) values
  ('markets', '{"es":"Mercados financieros","en":"Financial markets"}', 'Landmark', 1),
  ('trading', '{"es":"Trading","en":"Trading"}', 'CandlestickChart', 2),
  ('investing', '{"es":"Inversión","en":"Investing"}', 'TrendingUp', 3),
  ('technical', '{"es":"Análisis técnico","en":"Technical analysis"}', 'LineChart', 4),
  ('fundamental', '{"es":"Análisis fundamental","en":"Fundamental analysis"}', 'SearchCheck', 5),
  ('risk', '{"es":"Gestión del riesgo","en":"Risk management"}', 'ShieldCheck', 6),
  ('portfolios', '{"es":"Portafolios","en":"Portfolios"}', 'PieChart', 7),
  ('macro', '{"es":"Macroeconomía","en":"Macroeconomics"}', 'Globe2', 8),
  ('instruments', '{"es":"Instrumentos financieros","en":"Financial instruments"}', 'Layers3', 9),
  ('psychology', '{"es":"Psicología financiera","en":"Financial psychology"}', 'Brain', 10);

insert into public.learning_courses(
  external_key, slug, title, short_title, description, outcomes, category_id, difficulty,
  estimated_duration_minutes, status, is_official, is_featured, published_at
)
select seed.external_key, seed.slug, seed.title::jsonb, seed.short_title::jsonb, seed.description::jsonb,
  seed.outcomes::jsonb, category.id, seed.difficulty, seed.duration, 'published', true, seed.featured, now()
from (values
  ('market-foundations','fundamentos-mercados-financieros','{"es":"Fundamentos de los mercados financieros","en":"Financial market foundations"}','{"es":"Fundamentos de mercados","en":"Market foundations"}','{"es":"Comprende cómo se conectan participantes, activos, precios y bolsas.","en":"Understand how participants, assets, prices, and exchanges connect."}','[{"es":"Distinguir los principales mercados e instrumentos.","en":"Distinguish the main markets and instruments."}]','markets','beginner',270,true),
  ('technical-analysis','analisis-tecnico','{"es":"Fundamentos del análisis técnico","en":"Technical analysis fundamentals"}','{"es":"Análisis técnico","en":"Technical analysis"}','{"es":"Interpreta precio, volumen, tendencias y niveles relevantes.","en":"Interpret price, volume, trends, and relevant levels."}','[{"es":"Identificar tendencias, soportes y resistencias.","en":"Identify trends, support, and resistance."}]','technical','beginner',220,true),
  ('risk-management','gestion-del-riesgo','{"es":"Gestión del riesgo","en":"Risk management"}','{"es":"Gestión del riesgo","en":"Risk management"}','{"es":"Define cuánto arriesgar, cómo dimensionar una posición y cuándo una idea deja de ser válida.","en":"Define how much to risk, how to size a position, and when an idea is invalid."}','[{"es":"Calcular el riesgo monetario de una operación.","en":"Calculate the monetary risk of a trade."}]','risk','intermediate',185,true),
  ('investment-intro','introduccion-inversion','{"es":"Introducción a la inversión","en":"Introduction to investing"}','{"es":"Introducción a la inversión","en":"Introduction to investing"}','{"es":"Construye una base para invertir con objetivos y horizonte definidos.","en":"Build an investing foundation with clear goals and horizon."}','[]','investing','beginner',160,false),
  ('fundamental-analysis','analisis-fundamental','{"es":"Análisis fundamental","en":"Fundamental analysis"}','{"es":"Análisis fundamental","en":"Fundamental analysis"}','{"es":"Conecta estados financieros, negocio, valoración y contexto.","en":"Connect financial statements, business, valuation, and context."}','[]','fundamental','intermediate',310,true),
  ('portfolio-construction','construccion-portafolios','{"es":"Construcción y gestión de portafolios","en":"Portfolio construction and management"}','{"es":"Gestión de portafolios","en":"Portfolio management"}','{"es":"Combina activos con intención y evalúa el riesgo del conjunto.","en":"Combine assets intentionally and evaluate portfolio risk."}','[]','portfolios','intermediate',260,false),
  ('macro-markets','macroeconomia-mercados','{"es":"Macroeconomía aplicada a mercados","en":"Macroeconomics applied to markets"}','{"es":"Macroeconomía aplicada","en":"Applied macroeconomics"}','{"es":"Interpreta inflación, tasas, crecimiento y política monetaria.","en":"Interpret inflation, rates, growth, and monetary policy."}','[]','macro','advanced',295,false),
  ('decision-psychology','psicologia-decisiones','{"es":"Psicología y toma de decisiones","en":"Psychology and decision-making"}','{"es":"Psicología financiera","en":"Financial psychology"}','{"es":"Reconoce sesgos y mejora la calidad de tus decisiones bajo presión.","en":"Recognize biases and improve decisions under pressure."}','[]','psychology','intermediate',145,true)
) as seed(external_key,slug,title,short_title,description,outcomes,category_slug,difficulty,duration,featured)
join public.learning_categories category on category.slug = seed.category_slug;

insert into public.learning_course_modules(course_id, external_key, title, position)
select course.id, seed.module_key, seed.title::jsonb, seed.position
from (values
  ('market-foundations','market-basics','{"es":"El ecosistema financiero","en":"The financial ecosystem"}',1),
  ('market-foundations','assets-and-orders','{"es":"Activos y órdenes","en":"Assets and orders"}',2),
  ('technical-analysis','introduction','{"es":"Introducción","en":"Introduction"}',1),
  ('technical-analysis','trends','{"es":"Tendencias","en":"Trends"}',2),
  ('technical-analysis','indicators','{"es":"Indicadores y confirmación","en":"Indicators and confirmation"}',3),
  ('risk-management','risk-principles','{"es":"Principios de riesgo","en":"Risk principles"}',1),
  ('risk-management','position-sizing','{"es":"Tamaño y relación riesgo/rentabilidad","en":"Sizing and risk-return"}',2),
  ('investment-intro','investment-plan','{"es":"Tu plan de inversión","en":"Your investment plan"}',1),
  ('fundamental-analysis','company-analysis','{"es":"Entender una compañía","en":"Understanding a company"}',1),
  ('portfolio-construction','portfolio-basics','{"es":"Arquitectura del portafolio","en":"Portfolio architecture"}',1),
  ('macro-markets','macro-cycle','{"es":"El ciclo macroeconómico","en":"The macroeconomic cycle"}',1),
  ('decision-psychology','biases','{"es":"Sesgos y proceso","en":"Biases and process"}',1)
) as seed(course_key,module_key,title,position)
join public.learning_courses course on course.external_key = seed.course_key;

insert into public.learning_lessons(module_id, external_key, slug, title, lesson_type, estimated_duration_minutes, position, status, published_at)
select module.id, seed.lesson_key, seed.lesson_key, seed.title::jsonb, seed.lesson_type, seed.duration, seed.position, 'published', now()
from (values
  ('market-basics','que-son-los-mercados','{"es":"¿Qué son los mercados financieros?","en":"What are financial markets?"}','lesson',14,1),
  ('market-basics','participantes','{"es":"Participantes y sus objetivos","en":"Participants and their goals"}','lesson',18,2),
  ('market-basics','formacion-precios','{"es":"Cómo se forma un precio","en":"How a price is formed"}','lesson',20,3),
  ('assets-and-orders','activos-financieros','{"es":"Activos financieros","en":"Financial assets"}','lesson',16,1),
  ('assets-and-orders','bolsa','{"es":"Funcionamiento de una bolsa","en":"How an exchange works"}','video',22,2),
  ('assets-and-orders','ordenes','{"es":"Órdenes de mercado y límite","en":"Market and limit orders"}','practice',24,3),
  ('introduction','introduccion','{"es":"¿Qué es el análisis técnico?","en":"What is technical analysis?"}','lesson',12,1),
  ('introduction','precio','{"es":"Precio y estructura","en":"Price and structure"}','lesson',17,2),
  ('introduction','volumen','{"es":"Volumen y participación","en":"Volume and participation"}','video',18,3),
  ('trends','tendencias','{"es":"Tendencias del mercado","en":"Market trends"}','lesson',22,1),
  ('trends','soportes','{"es":"Soportes","en":"Support"}','practice',24,2),
  ('trends','resistencias','{"es":"Resistencias","en":"Resistance"}','practice',24,3),
  ('indicators','medias-moviles','{"es":"Medias móviles","en":"Moving averages"}','lesson',26,1),
  ('indicators','rsi','{"es":"RSI y momentum","en":"RSI and momentum"}','quiz',28,2),
  ('indicators','plan-tecnico','{"es":"Construye un plan técnico","en":"Build a technical plan"}','assessment',30,3),
  ('risk-principles','incertidumbre','{"es":"Riesgo e incertidumbre","en":"Risk and uncertainty"}','lesson',16,1),
  ('risk-principles','regla-uno','{"es":"La regla del 1 %","en":"The 1% rule"}','practice',21,2),
  ('risk-principles','stop-loss','{"es":"Stop-loss e invalidación","en":"Stop-loss and invalidation"}','lesson',22,3),
  ('position-sizing','tamano-posicion','{"es":"Tamaño de posición","en":"Position sizing"}','practice',24,1),
  ('position-sizing','riesgo-rentabilidad','{"es":"Relación riesgo/rentabilidad","en":"Risk-return ratio"}','lesson',28,2),
  ('position-sizing','limites-portafolio','{"es":"Límites del portafolio","en":"Portfolio limits"}','assessment',26,3),
  ('investment-plan','objetivos','{"es":"Objetivos financieros","en":"Financial goals"}','lesson',18,1),
  ('investment-plan','horizonte','{"es":"Horizonte y liquidez","en":"Horizon and liquidity"}','lesson',20,2),
  ('investment-plan','perfil','{"es":"Perfil de riesgo","en":"Risk profile"}','quiz',24,3),
  ('company-analysis','modelo-negocio','{"es":"Modelo de negocio","en":"Business model"}','lesson',24,1),
  ('company-analysis','estados-financieros','{"es":"Estados financieros","en":"Financial statements"}','video',32,2),
  ('company-analysis','valoracion','{"es":"Introducción a la valoración","en":"Introduction to valuation"}','practice',35,3),
  ('portfolio-basics','diversificacion','{"es":"Diversificación","en":"Diversification"}','lesson',22,1),
  ('portfolio-basics','correlacion','{"es":"Correlación","en":"Correlation"}','lesson',24,2),
  ('portfolio-basics','rebalanceo','{"es":"Rebalanceo","en":"Rebalancing"}','practice',26,3),
  ('macro-cycle','inflacion','{"es":"Inflación","en":"Inflation"}','lesson',25,1),
  ('macro-cycle','tasas','{"es":"Tasas de interés","en":"Interest rates"}','lesson',28,2),
  ('macro-cycle','politica-monetaria','{"es":"Política monetaria","en":"Monetary policy"}','video',31,3),
  ('biases','sesgos','{"es":"Sesgos cognitivos","en":"Cognitive biases"}','lesson',20,1),
  ('biases','emociones','{"es":"Decidir bajo presión","en":"Deciding under pressure"}','lesson',22,2),
  ('biases','diario','{"es":"Diario de decisiones","en":"Decision journal"}','practice',24,3)
) as seed(module_key,lesson_key,title,lesson_type,duration,position)
join public.learning_course_modules module on module.external_key = seed.module_key;

-- Every seeded lesson receives structured blocks. Editors can replace or reorder them independently.
insert into public.learning_lesson_blocks(lesson_id, block_type, position, content)
select lesson.id, block.block_type, block.position, block.content
from public.learning_lessons lesson
cross join lateral (values
  ('lead', 1, jsonb_build_object('text', jsonb_build_object(
    'es', 'Comprende este concepto y úsalo para analizar decisiones financieras con mejores criterios.',
    'en', 'Understand this concept and use it to analyze financial decisions with better judgment.'
  ))),
  ('heading', 2, jsonb_build_object('text', jsonb_build_object('es', 'Idea central', 'en', 'Core idea'))),
  ('text', 3, jsonb_build_object('text', jsonb_build_object(
    'es', 'Los mercados combinan información, expectativas y riesgo. El objetivo es reconocer cómo cambia una decisión cuando cambian sus supuestos.',
    'en', 'Markets combine information, expectations, and risk. The goal is to recognize how a decision changes when its assumptions change.'
  ))),
  ('note', 4, jsonb_build_object(
    'title', jsonb_build_object('es', 'Recuerda', 'en', 'Remember'),
    'text', jsonb_build_object('es', 'Una herramienta es útil cuando conoces sus límites.', 'en', 'A tool is useful when you understand its limits.')
  )),
  ('example', 5, jsonb_build_object(
    'title', jsonb_build_object('es', 'Ejemplo aplicado', 'en', 'Applied example'),
    'text', jsonb_build_object('es', 'Compara dos escenarios e identifica qué variable cambió.', 'en', 'Compare two scenarios and identify which variable changed.')
  )),
  ('practice', 6, jsonb_build_object(
    'title', jsonb_build_object('es', 'Aplicar en GlobalTradeLab', 'en', 'Apply in GlobalTradeLab'),
    'text', jsonb_build_object('es', 'Abre el mercado de tu clase y observa el concepto en un gráfico.', 'en', 'Open your class market and observe the concept on a chart.')
  ))
) as block(block_type, position, content);

insert into public.learning_paths(external_key, slug, title, description, difficulty, estimated_duration_minutes, icon, offers_certificate, status, published_at) values
  ('path-market-intro','introduccion-mercados','{"es":"Introducción a los mercados","en":"Introduction to markets"}','{"es":"La ruta inicial para comprender el sistema financiero.","en":"The starting path to understand the financial system."}','beginner',430,'Compass',true,'published',now()),
  ('path-trading','trading','{"es":"Trading con método","en":"Methodical trading"}','{"es":"Del lenguaje del precio a un plan con reglas de riesgo.","en":"From price language to a plan with risk rules."}','intermediate',520,'CandlestickChart',true,'published',now()),
  ('path-analysis','analisis-integral','{"es":"Análisis integral","en":"Integrated analysis"}','{"es":"Combina lectura técnica, fundamentos y contexto macroeconómico.","en":"Combine technical reading, fundamentals, and macro context."}','advanced',825,'ScanSearch',true,'published',now()),
  ('path-portfolio','gestor-portafolios','{"es":"Gestor de portafolios","en":"Portfolio manager"}','{"es":"Diseña, controla y evalúa portafolios con visión de conjunto.","en":"Design, control, and evaluate portfolios holistically."}','intermediate',605,'PieChart',true,'published',now());

insert into public.learning_path_items(path_id, course_id, position)
select path.id, course.id, seed.position
from (values
  ('path-market-intro','market-foundations',1),('path-market-intro','investment-intro',2),('path-market-intro','risk-management',3),
  ('path-trading','technical-analysis',1),('path-trading','risk-management',2),('path-trading','decision-psychology',3),
  ('path-analysis','technical-analysis',1),('path-analysis','fundamental-analysis',2),('path-analysis','macro-markets',3),
  ('path-portfolio','investment-intro',1),('path-portfolio','portfolio-construction',2),('path-portfolio','risk-management',3)
) as seed(path_key,course_key,position)
join public.learning_paths path on path.external_key = seed.path_key
join public.learning_courses course on course.external_key = seed.course_key;
