CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Uncategorized';
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS model_number TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_key TEXT NOT NULL DEFAULT '';
ALTER TABLE parts ADD COLUMN IF NOT EXISTS image_key TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS image_key TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  equipment TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_parts_slug ON parts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL DEFAULT '',
  image_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_key TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS sent_emails (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  from_address TEXT NOT NULL DEFAULT 'contact@tahinspare.com',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  resend_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS in_reply_to_inbound_id TEXT NOT NULL DEFAULT '';
ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS attachments_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS delivery_error TEXT NOT NULL DEFAULT '';
ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS inbound_emails (
  id TEXT PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS resend_email_id TEXT NOT NULL DEFAULT '';
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS message_id TEXT NOT NULL DEFAULT '';
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS html_body TEXT NOT NULL DEFAULT '';
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS attachments_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS forward_status TEXT NOT NULL DEFAULT 'forwarded';
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS forward_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS forward_attempted_at TIMESTAMPTZ;
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ;
ALTER TABLE inbound_emails ADD COLUMN IF NOT EXISTS forward_error TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sent_emails_created ON sent_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_emails_reply_to_inbound ON sent_emails(in_reply_to_inbound_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_delivery_status ON sent_emails(delivery_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_emails_resend_id_unique
  ON sent_emails(resend_id) WHERE resend_id <> '';
CREATE INDEX IF NOT EXISTS idx_inbound_emails_created ON inbound_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_read ON inbound_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_resend_id ON inbound_emails(resend_email_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_emails_resend_id_unique
  ON inbound_emails(resend_email_id) WHERE resend_email_id <> '';
CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON inbound_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_forward_status ON inbound_emails(forward_status);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES categories(id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);

ALTER TABLE products ADD COLUMN IF NOT EXISTS part_number TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS availability_verified_at DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS condition_verified_at DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS technical_specifications TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS application TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS focus_keyword TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_alt TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS related_products TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_model_number ON products(model_number);
CREATE INDEX IF NOT EXISTS idx_products_part_number ON products(part_number);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT NOT NULL DEFAULT '',
  logo_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);

CREATE TABLE IF NOT EXISTS page_sections (
  page_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page_key, section_key)
);

CREATE INDEX IF NOT EXISTS idx_page_sections_page_key ON page_sections(page_key);

CREATE TABLE IF NOT EXISTS page_overrides (
  page_key TEXT PRIMARY KEY,
  overrides_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_overrides_updated ON page_overrides(updated_at DESC);
