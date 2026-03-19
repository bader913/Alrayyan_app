-- ── Expenses Table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id            BIGSERIAL PRIMARY KEY,
  title         VARCHAR(200)   NOT NULL,
  category      VARCHAR(100)   NOT NULL DEFAULT 'عام',
  amount        NUMERIC(14,4)  NOT NULL CHECK (amount > 0),
  currency      VARCHAR(10)    NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(14,6)  NOT NULL DEFAULT 1,
  amount_usd    NUMERIC(14,4)  NOT NULL,
  expense_date  DATE           NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expenses_date_idx     ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category);
