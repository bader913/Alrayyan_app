import express from "express";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, use the app's user data directory for the database
const isProd = process.env.NODE_ENV === "production";
const dbPath =
  isProd && process.env.DB_PATH
    ? path.join(process.env.DB_PATH, "supermarket.db")
    : "supermarket.db";
console.log(`Using database at: ${dbPath}`);
    const authDbPath =
  isProd && process.env.AUTH_DB_PATH
    ? process.env.AUTH_DB_PATH
    : "auth.db";

console.log(`Using auth database at: ${authDbPath}`);

const licenseFilePath =

  process.env.LICENSE_PATH ||
  (isProd && process.env.DB_PATH
    ? path.join(process.env.DB_PATH, "license.dat")
    : path.join(process.cwd(), "license.dat"));

const LICENSE_SECRET = "ALRAYYAN::BADER::2026::ULTRA::LICENSE::9f2aA!77xK@91Lm#Qp$2Z";

const getDeviceFingerprint = () => {
  const raw = [
    process.env.APP_INSTANCE_NAME || "ALRAYYAN",
    os.hostname(),
    os.platform(),
    os.arch(),
    process.env.COMPUTERNAME || "",
    process.env.USERDOMAIN || "",
    process.env.PROCESSOR_IDENTIFIER || ""
  ].join("|");

  return crypto.createHash("sha256").update(raw).digest("hex");
};

const signLicensePayload = (payload: Omit<LicenseFileData, "signature">) => {
  return crypto
    .createHmac("sha256", LICENSE_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
};

const readLicenseFile = (): LicenseFileData | null => {
  try {
    if (!fs.existsSync(licenseFilePath)) return null;
    const raw = fs.readFileSync(licenseFilePath, "utf8");
    return JSON.parse(raw) as LicenseFileData;
  } catch (error) {
    console.error("Failed to read license file:", error);
    return null;
  }
};

const writeLicenseFile = (data: Omit<LicenseFileData, "signature">) => {
  const finalData: LicenseFileData = {
    ...data,
    signature: signLicensePayload(data)
  };

  fs.writeFileSync(licenseFilePath, JSON.stringify(finalData, null, 2), "utf8");
  return finalData;
};

const verifyLicenseFile = () => {
  const license = readLicenseFile();

  if (!license) {
    return {
      valid: false,
      reason: "license_missing"
    };
  }

  const payloadWithoutSignature = {
    license_type: license.license_type,
    starts_at: license.starts_at,
    expires_at: license.expires_at,
    is_active: license.is_active,
    notes: license.notes,
    device_fingerprint: license.device_fingerprint
  };

  const expectedSignature = signLicensePayload(payloadWithoutSignature);

  if (license.signature !== expectedSignature) {
    return {
      valid: false,
      reason: "license_tampered"
    };
  }

  const currentFingerprint = getDeviceFingerprint();

  if (license.device_fingerprint !== currentFingerprint) {
    return {
      valid: false,
      reason: "device_mismatch"
    };
  }

  const expiresAt = new Date(license.expires_at);

  if (!license.is_active || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return {
      valid: false,
      reason: "license_expired"
    };
  }

  return {
    valid: true,
    license
  };
};
type AsyncHandler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => Promise<any>;
type SubscriptionRow = {
  id: number;
  license_type: "trial" | "yearly" | "two_years" | "three_years";
  starts_at: string;
  expires_at: string;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
type LicenseFileData = {
  license_type: "trial" | "yearly" | "two_years" | "three_years";
  starts_at: string;
  expires_at: string;
  is_active: number;
  notes: string | null;
  device_fingerprint: string;
  signature: string;
};

const asyncHandler = (fn: AsyncHandler) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export async function startServer() {
  // IMPORTANT:
  // writeDb => all writes + transactions
    const getSettingsObject = async () => {
    const rows = await readDb.all("SELECT key, value FROM settings");
    return rows.reduce((acc: any, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  };

  const getRateFromUSD = async (currencyCode: string) => {
    const settings = await getSettingsObject();

    const usdToSyp = Number(settings?.usd_to_syp || 11000);
    const usdToTry = Number(settings?.usd_to_try || 44);
    const usdToSar = Number(settings?.usd_to_sar || 3.75);
    const usdToAed = Number(settings?.usd_to_aed || 3.67);

    switch (currencyCode) {
      case "SYP":
        return usdToSyp;
      case "TRY":
        return usdToTry;
      case "SAR":
        return usdToSar;
      case "AED":
        return usdToAed;
      case "USD":
      default:
        return 1;
    }
  };

  const calculateOriginalAmountFromBaseUSD = async (amountBaseUSD: number, currencyCode?: string) => {
    const safeCurrency = currencyCode || "USD";
    const rate = await getRateFromUSD(safeCurrency);
    return {
      amount_original: Number(amountBaseUSD || 0) * Number(rate || 1),
      exchange_rate: Number(rate || 1),
      currency_code: safeCurrency
    };
  };
  // readDb  => all reads only
  const writeDb = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  const readDb = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  const authWriteDb = await open({
  filename: authDbPath,
  driver: sqlite3.Database
});

const authReadDb = await open({
  filename: authDbPath,
  driver: sqlite3.Database
});

 for (const db of [writeDb, readDb, authWriteDb, authReadDb]) {
  await db.exec("PRAGMA foreign_keys = ON;");
  await db.exec("PRAGMA journal_mode = WAL;");
  await db.exec("PRAGMA synchronous = NORMAL;");
  await db.exec("PRAGMA busy_timeout = 5000;");
}
  // the eshtrak
    const addMinutes = (date: Date, minutes: number) => {
    const next = new Date(date);
    next.setMinutes(next.getMinutes() + minutes);
    return next;
  };

  const addYears = (date: Date, years: number) => {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  };
  const RENEWAL_CODES: Record<string, { license_type: "trial" | "yearly" | "two_years" | "three_years"; minutes?: number; years?: number; successMessage: string; note: string; }> = {
  "ALRAYYAN-TRIAL-Q2W8-2026": {
    license_type: "trial",
    minutes: 3,
    successMessage: "تم تفعيل الاشتراك التجريبي بنجاح لمدة 3 دقائق",
    note: "اشتراك تجريبي لمدة 3 دقائق"
  },
  "ALRAYYAN-Y1-8KQ2-2026": {
    license_type: "yearly",
    years: 1,
    successMessage: "تم تجديد الاشتراك لمدة سنة بنجاح",
    note: "تجديد سنة واحدة"
  },
  "ALRAYYAN-Y2-M7P4-2026": {
    license_type: "two_years",
    years: 2,
    successMessage: "تم تجديد الاشتراك لمدة سنتين بنجاح",
    note: "تجديد سنتين"
  },
  "ALRAYYAN-Y3-X9T1-2026": {
    license_type: "three_years",
    years: 3,
    successMessage: "تم تجديد الاشتراك لمدة 3 سنوات بنجاح",
    note: "تجديد 3 سنوات"
  },
  "ALRAYYAN-TRIAL-7DAYS-R8N4-2026": {
  license_type: "trial",
  minutes: 10080,
  successMessage: "تم تفعيل الاشتراك التجريبي لمدة أسبوع بنجاح",
  note: "اشتراك تجريبي لمدة أسبوع"
},
 "ALRAYYAN-TRIAL-30DAYS-R8N3-2026": {
  license_type: "trial",
  minutes: 43200,
  successMessage: "تم تفعيل الاشتراك التجريبي لمدة شهر بنجاح",
  note: "اشتراك تجريبي لمدة شهر"
},
  

};

  const getCurrentSubscription = async (): Promise<SubscriptionRow | null> => {
    return (await readDb.get(
      `
      SELECT *
      FROM subscriptions
      ORDER BY id DESC
      LIMIT 1
      `
    )) as SubscriptionRow | null;
  };

  const getSubscriptionStatus = async () => {
  const verified = verifyLicenseFile();

 if (!verified.valid || !verified.license) {
  return {
    exists: false,
    isExpired: true,
    isActive: false,
    readOnly: true,
    reason: verified.reason || "license_missing",
    message: "لا يوجد ترخيص صالح على هذا الجهاز. يرجى التواصل مع المزود.",
    subscription: null,
    remainingMinutes: 0,
    remainingDays: 0
  };
}

  const subscription = verified.license;
  const now = new Date();
  const expiresAt = new Date(subscription.expires_at);
  const isExpired =
    !subscription.is_active || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime();

  const diffMs = Math.max(0, expiresAt.getTime() - now.getTime());
  const remainingMinutes = Math.floor(diffMs / (1000 * 60));
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    exists: true,
    isExpired,
    isActive: !isExpired,
    readOnly: isExpired,
    message: isExpired
      ? "انتهى الاشتراك. البرنامج الآن في وضع القراءة فقط. للتجديد يرجى التواصل مع المزود."
      : "الاشتراك ساري المفعول",
    subscription: {
      id: 1,
      license_type: subscription.license_type,
      starts_at: subscription.starts_at,
      expires_at: subscription.expires_at,
      is_active: subscription.is_active
    },
    remainingMinutes,
    remainingDays
  };
};

  const seedSubscriptionIfMissing = async () => {
  const existing = (await readDb.get(
    "SELECT COUNT(*) as count FROM subscriptions"
  )) as { count: number };

  if ((existing?.count || 0) > 0) return;

  console.log("No subscription found yet. App will remain read-only until a valid renewal code is entered.");
};

  // queue all write operations to avoid overlapping write transactions on same sqlite connection
  let writeQueue: Promise<void> = Promise.resolve();

  const enqueueWrite = async <T>(operation: () => Promise<T>): Promise<T> => {
    const resultPromise = writeQueue.then(operation, operation);
    writeQueue = resultPromise.then(
      () => undefined,
      () => undefined
    );
    return resultPromise;
  };

  const runTransaction = async <T>(operation: () => Promise<T>): Promise<T> => {
    return enqueueWrite(async () => {
      await writeDb.exec("BEGIN IMMEDIATE TRANSACTION");
      try {
        const result = await operation();
        await writeDb.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          await writeDb.exec("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Rollback failed:", rollbackErr);
        }
        throw error;
      }
    });
  };

  // Initialize Database Schema
  await writeDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  full_name TEXT,
  role TEXT CHECK(role IN ('admin', 'cashier', 'warehouse')),
  avatar_url TEXT,
  is_protected_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
   

 
  CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 1,
  opening_balance REAL DEFAULT 0,
  opening_balance_original REAL DEFAULT 0,
  opening_note TEXT,
  closing_note TEXT,
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  closing_cash_counted REAL DEFAULT 0,
  closing_cash_counted_original REAL DEFAULT 0,
  expected_cash REAL DEFAULT 0,
  expected_cash_original REAL DEFAULT 0,
  difference REAL DEFAULT 0,
  difference_original REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
    CREATE TABLE IF NOT EXISTS customer_account_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('sale', 'payment', 'adjustment')),
  reference_id INTEGER,
  reference_type TEXT,
  debit_amount REAL NOT NULL DEFAULT 0,
  credit_amount REAL NOT NULL DEFAULT 0,
  balance_after REAL NOT NULL DEFAULT 0,
  amount_original REAL,
  currency_code TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 1,
  note TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS supplier_account_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('purchase', 'payment', 'adjustment')),
  reference_id INTEGER,
  reference_type TEXT,
  debit_amount REAL NOT NULL DEFAULT 0,
  credit_amount REAL NOT NULL DEFAULT 0,
  balance_after REAL NOT NULL DEFAULT 0,
  amount_original REAL,
  currency_code TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 1,
  note TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id)
);

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      address TEXT,
      balance REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      address TEXT,
      balance REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT,
      name TEXT ,
      category_id INTEGER,
      unit TEXT,
      purchase_price REAL,
      sale_price REAL,
      stock_quantity REAL DEFAULT 0,
      min_stock_level REAL DEFAULT 5,
      expiry_date DATE,
      image_url TEXT,
      supplier_id INTEGER,
      notes TEXT,
      FOREIGN KEY(category_id) REFERENCES categories(id),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_barcode_unique
ON products(name, barcode);

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      total_amount REAL,
      discount REAL DEFAULT 0,
      paid_amount REAL,
      payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'credit')),
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      quantity REAL,
      unit_price REAL,
      total_price REAL,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
 CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    customer_id INTEGER,
    user_id INTEGER,
    shift_id INTEGER,
    return_date TEXT DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    return_method TEXT NOT NULL DEFAULT 'cash_refund',
    notes TEXT,
    total_amount REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS sales_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    sale_item_id INTEGER,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      total_amount REAL,
      paid_amount REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER,
      product_id INTEGER,
      quantity REAL,
      unit_price REAL,
      total_price REAL,
      FOREIGN KEY(purchase_id) REFERENCES purchases(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT,
      amount REAL,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
        CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_type TEXT NOT NULL CHECK(license_type IN ('trial', 'yearly', 'two_years', 'three_years')),
      starts_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  console.log("Account transaction tables ready");
await authWriteDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    full_name TEXT,
    role TEXT CHECK(role IN ('admin', 'cashier', 'warehouse')),
    avatar_url TEXT,
    is_protected_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
  const getDefaultSettings = () => [
    { key: "shop_name", value: "سوبر ماركت" },
    { key: "shop_phone", value: "096xxxx" },
    { key: "shop_address", value: "ادلب " },
    { key: "shop_tax_number", value: "0xxx0" },
    { key: "currency", value: "ل.س" },
    { key: "usd_to_syp", value: "116" },
    { key: "usd_to_try", value: "44" },
    { key: "receipt_footer", value: "شكراً لزيارتكم، نرجو زيارتنا مرة أخرى!" },
    { key: "low_stock_threshold", value: "10" },
    { key: "theme_color", value: "#059669" },
    { key: "theme_mode", value: "light" },
    { key: "show_usd", value: "true" },
    { key: "enable_shifts", value: "false" },
  ];

  // Seed default settings
  const settingsCount = (await readDb.get("SELECT COUNT(*) as count FROM settings")) as { count: number };
  if (settingsCount.count === 0) {
    for (const s of getDefaultSettings()) {
      await writeDb.run("INSERT INTO settings (key, value) VALUES (?, ?)", s.key, s.value);
    }
  }
  //enable shifts
const enableShiftsSetting = await readDb.get(
  "SELECT value FROM settings WHERE key = ?",
  "enable_shifts"
) as any;

if (!enableShiftsSetting) {
  await writeDb.run(
    "INSERT INTO settings (key, value) VALUES (?, ?)",
    "enable_shifts",
    "false"
  );
}
  // Migration: Add image_url to products if it doesn't exist
  try {
    await readDb.get("SELECT image_url FROM products LIMIT 1");
  } catch {
    console.log("Adding image_url column to products table...");
    await writeDb.exec("ALTER TABLE products ADD COLUMN image_url TEXT");
  }
  // Migration: Add shift_id to sales if it doesn't exist
try {
  await readDb.get("SELECT shift_id FROM sales LIMIT 1");
} catch {
  console.log("Adding shift_id column to sales table...");
  await writeDb.exec("ALTER TABLE sales ADD COLUMN shift_id INTEGER REFERENCES shifts(id)");
}
const ensureShiftColumn = async (columnName: string, definition: string) => {
  try {
    await readDb.get(`SELECT ${columnName} FROM shifts LIMIT 1`);
  } catch {
    console.log(`Adding ${columnName} column to shifts table...`);
    await writeDb.exec(`ALTER TABLE shifts ADD COLUMN ${columnName} ${definition}`);
  }
};

await ensureShiftColumn("currency_code", "TEXT DEFAULT 'USD'");
await ensureShiftColumn("exchange_rate", "REAL DEFAULT 1");
await ensureShiftColumn("opening_balance_original", "REAL DEFAULT 0");
await ensureShiftColumn("closing_cash_counted_original", "REAL DEFAULT 0");
await ensureShiftColumn("expected_cash_original", "REAL DEFAULT 0");
await ensureShiftColumn("difference_original", "REAL DEFAULT 0");
try {
  await authReadDb.get("SELECT is_protected_admin FROM users LIMIT 1");
} catch {
  console.log("Adding is_protected_admin column to auth users table...");
  await authWriteDb.exec("ALTER TABLE users ADD COLUMN is_protected_admin INTEGER DEFAULT 0");
}
try {
  await authReadDb.get("SELECT avatar_url FROM users LIMIT 1");
} catch {
  console.log("Adding avatar_url column to auth users table...");
  await authWriteDb.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
}
  const hashPasswordIfNeeded = async (rawPassword: string) => {
    if (
      rawPassword.startsWith("$2a$") ||
      rawPassword.startsWith("$2b$") ||
      rawPassword.startsWith("$2y$")
    ) {
      return rawPassword;
    }
    return bcrypt.hash(rawPassword, 10);
  };
const syncAuthUserToMainDb = async (userId: number) => {
  const authUser = await authReadDb.get(
    `
    SELECT id, username, password, full_name, role, avatar_url, is_protected_admin, created_at
    FROM users
    WHERE id = ?
    `,
    userId
  ) as any;

  if (!authUser) {
    await writeDb.run("DELETE FROM users WHERE id = ?", userId);
    return;
  }

  await writeDb.run(
    `
    INSERT INTO users (
      id,
      username,
      password,
      full_name,
      role,
      avatar_url,
      is_protected_admin,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      full_name = excluded.full_name,
      role = excluded.role,
      avatar_url = excluded.avatar_url,
      is_protected_admin = excluded.is_protected_admin,
      created_at = excluded.created_at
    `,
    authUser.id,
    authUser.username,
    authUser.password,
    authUser.full_name,
    authUser.role,
    authUser.avatar_url || null,
    Number(authUser.is_protected_admin || 0),
    authUser.created_at
  );
};

const syncAllAuthUsersToMainDb = async () => {
  const authUsers = await authReadDb.all(
    `
    SELECT id, username, password, full_name, role, avatar_url, is_protected_admin, created_at
    FROM users
    ORDER BY id ASC
    `
  ) as any[];

  await enqueueWrite(async () => {
    await writeDb.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      for (const user of authUsers) {
        await writeDb.run(
          `
          INSERT INTO users (
            id,
            username,
            password,
            full_name,
            role,
            avatar_url,
            is_protected_admin,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            password = excluded.password,
            full_name = excluded.full_name,
            role = excluded.role,
            avatar_url = excluded.avatar_url,
            is_protected_admin = excluded.is_protected_admin,
            created_at = excluded.created_at
          `,
          user.id,
          user.username,
          user.password,
          user.full_name,
          user.role,
          user.avatar_url || null,
          Number(user.is_protected_admin || 0),
          user.created_at
        );
      }

      await writeDb.exec("COMMIT");
    } catch (error) {
      try {
        await writeDb.exec("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Rollback failed while syncing users to main db:", rollbackErr);
      }
      throw error;
    }
  });
};
  // Seed initial users if not exists
 const adminExists = await authReadDb.get("SELECT * FROM users WHERE username = ?", "admin");
if (!adminExists) {
  await authWriteDb.run(
    "INSERT INTO users (username, password, full_name, role, is_protected_admin) VALUES (?, ?, ?, ?, ?)",
    "admin",
    await bcrypt.hash("Baderzeek1991", 10),
    "المدير العام",
    "admin",
    1
  );
} else {
  await authWriteDb.run(
    "UPDATE users SET is_protected_admin = 1 WHERE username = ?",
    "admin"
  );
}

const cashierExists = await authReadDb.get("SELECT * FROM users WHERE username = ?", "cashier1");
if (!cashierExists) {
  await authWriteDb.run(
    "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
    "cashier1",
    await bcrypt.hash("cashier123", 10),
    "موظف كاشير",
    "cashier"
  );
}

const warehouseExists = await authReadDb.get("SELECT * FROM users WHERE username = ?", "warehouse1");
if (!warehouseExists) {
  await authWriteDb.run(
    "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
    "warehouse1",
    await bcrypt.hash("warehouse123", 10),
    "موظف مخزن",
    "warehouse"
  );
}

const users = (await authReadDb.all("SELECT id, password FROM users")) as Array<{
  id: number;
  password: string;
}>;

for (const user of users) {
  if (user.password && !user.password.startsWith("$2")) {
    const hashed = await bcrypt.hash(user.password, 10);
    await authWriteDb.run("UPDATE users SET password = ? WHERE id = ?", hashed, user.id);
  }
}
await syncAllAuthUsersToMainDb();
  // Seed some categories
  const categoriesCount = (await readDb.get(
    "SELECT COUNT(*) as count FROM categories"
  )) as { count: number };

 if (categoriesCount.count === 0) {
  const initialCategories = [
    "مواد غذائية",
    "منظفات",
    "مشروبات",
    "أدوية ومستحضرات صحية",
    "خضروات وفواكه",
    "ألبان وأجبان",
    "دخان"
  ];

  for (const categoryName of initialCategories) {
    await writeDb.run("INSERT INTO categories (name) VALUES (?)", categoryName);
  }
}

await seedSubscriptionIfMissing();
const verifiedLicenseOnStartup = verifyLicenseFile();

if (!verifiedLicenseOnStartup.valid) {
  await writeDb.run("UPDATE subscriptions SET is_active = 0");
}
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "200mb" }));

  const PORT = Number(process.env.PORT || 3131);
  const subscriptionWriteWhitelist = new Set<string>([
  "/api/login",
  "/api/subscription/redeem"
]);

  app.use(async (req, res, next) => {
    const method = req.method.toUpperCase();

    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return next();
    }

    if (subscriptionWriteWhitelist.has(req.path)) {
      return next();
    }

    const status = await getSubscriptionStatus();

    if (status.isExpired) {
      return res.status(403).json({
        success: false,
        code: "SUBSCRIPTION_EXPIRED",
        read_only: true,
        message: "انتهى الاشتراك. البرنامج الآن في وضع القراءة فقط. للتجديد يرجى التواصل مع المزود."
      });
    }

    return next();
  });

const allTables = [
  "users",
  "shifts",
  "categories",
  "products",
  "suppliers",
  "supplier_account_transactions",
  "customers",
  "customer_account_transactions",
  "sales",
  "sale_items",
  "sales_returns",
  "sales_return_items",
  "purchases",
  "purchase_items",
  "expenses",
  "settings"
];

const deleteOrder = [
  "sales_return_items",
  "sales_returns",
  "sale_items",
  "purchase_items",
  "sales",
  "shifts",
  "purchases",
  "customer_account_transactions",
  "supplier_account_transactions",
  "expenses",
  "products",
  "customers",
  "suppliers",
  "categories",
  "settings"
];

const insertOrder = [
  "categories",
  "suppliers",
  "customers",
  "products",
  "shifts",
  "sales",
  "sale_items",
  "sales_returns",
  "sales_return_items",
  "purchases",
  "purchase_items",
  "customer_account_transactions",
  "supplier_account_transactions",
  "expenses",
  "settings"
];

  const isPlainObject = (value: unknown) => {
    return !!value && typeof value === "object" && !Array.isArray(value);
  };

  const validateBackupShape = (backupData: any) => {
    if (!backupData || typeof backupData !== "object" || Array.isArray(backupData)) {
      return "ملف النسخة الاحتياطية غير صالح";
    }

    for (const table of allTables) {
      if (!(table in backupData)) {
        return `النسخة الاحتياطية ناقصة: الجدول ${table} غير موجود`;
      }
    }

    for (const table of allTables) {
      if (table === "settings") {
        const settings = backupData.settings;
        if (!Array.isArray(settings) && !isPlainObject(settings)) {
          return "جدول settings في النسخة الاحتياطية غير صالح";
        }
      } else {
        if (!Array.isArray(backupData[table])) {
          return `الجدول ${table} يجب أن يكون مصفوفة`;
        }
      }
    }

    return null;
  };
const getOpenShift = async () => {
  return await readDb.get(
    `
    SELECT sh.*, u.full_name as user_name, u.username
    FROM shifts sh
    LEFT JOIN users u ON u.id = sh.user_id
    WHERE sh.status = 'open'
    ORDER BY sh.id DESC
    LIMIT 1
    `
  );
};

const getOpenShiftByUser = async (userId: number) => {
  return await readDb.get(
    `
    SELECT sh.*, u.full_name as user_name, u.username
    FROM shifts sh
    LEFT JOIN users u ON u.id = sh.user_id
    WHERE sh.status = 'open' AND sh.user_id = ?
    ORDER BY sh.id DESC
    LIMIT 1
    `,
    userId
  );
};

const calculateShiftSummary = async (shiftId: number) => {
  const salesTotals = await readDb.get(
    `
    SELECT
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN (total_amount - COALESCE(discount, 0)) ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN (total_amount - COALESCE(discount, 0)) ELSE 0 END), 0) as card_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN (total_amount - COALESCE(discount, 0)) ELSE 0 END), 0) as credit_sales,
      COALESCE(SUM(total_amount - COALESCE(discount, 0)), 0) as grand_total,
      COUNT(*) as sales_count
    FROM sales
    WHERE shift_id = ?
    `,
    shiftId
  ) as any;

  const returnsTotals = await readDb.get(
    `
    SELECT
      COALESCE(SUM(CASE WHEN return_method = 'cash_refund' THEN total_amount ELSE 0 END), 0) as cash_returns,
      COALESCE(SUM(CASE WHEN return_method = 'debt_discount' THEN total_amount ELSE 0 END), 0) as debt_returns,
      COALESCE(SUM(CASE WHEN return_method = 'stock_only' THEN total_amount ELSE 0 END), 0) as stock_only_returns,
      COALESCE(SUM(total_amount), 0) as total_returns,
      COUNT(*) as returns_count
    FROM sales_returns
    WHERE shift_id = ?
    `,
    shiftId
  ) as any;

  const cashSales = Number(salesTotals?.cash_sales || 0);
  const cardSales = Number(salesTotals?.card_sales || 0);
  const creditSales = Number(salesTotals?.credit_sales || 0);
  const grandTotalSales = Number(salesTotals?.grand_total || 0);
  const salesCount = Number(salesTotals?.sales_count || 0);

  const cashReturns = Number(returnsTotals?.cash_returns || 0);
  const debtReturns = Number(returnsTotals?.debt_returns || 0);
  const stockOnlyReturns = Number(returnsTotals?.stock_only_returns || 0);
  const totalReturns = Number(returnsTotals?.total_returns || 0);
  const returnsCount = Number(returnsTotals?.returns_count || 0);

  return {
    cash_sales: cashSales,
    card_sales: cardSales,
    credit_sales: creditSales,
    grand_total: grandTotalSales,
    sales_count: salesCount,

    cash_returns: cashReturns,
    debt_returns: debtReturns,
    stock_only_returns: stockOnlyReturns,
    total_returns: totalReturns,
    returns_count: returnsCount,

    net_cash: cashSales - cashReturns,
    net_total: grandTotalSales - totalReturns
  };
};
 const clearAllData = async () => {
  return enqueueWrite(async () => {
    await writeDb.exec("PRAGMA foreign_keys = OFF;");
    try {
      await writeDb.exec("BEGIN IMMEDIATE TRANSACTION");
      try {
        for (const table of deleteOrder) {
          await writeDb.run(`DELETE FROM ${table}`);
        }

        await writeDb.run("DELETE FROM sqlite_sequence");
        await writeDb.exec("COMMIT");
      } catch (error) {
        try {
          await writeDb.exec("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Rollback failed during clearAllData:", rollbackErr);
        }
        throw error;
      }
    } finally {
      await writeDb.exec("PRAGMA foreign_keys = ON;");
    }
  });
};

  // --- API Routes ---

  // Backup
  app.get("/api/backup", asyncHandler(async (req, res) => {
  const backupData: Record<string, any[]> = {};

  for (const table of allTables) {
    if (table === "users") {
      backupData[table] = await authReadDb.all(`
        SELECT id, username, password, full_name, role, is_protected_admin, created_at
        FROM users
      `);
    } else {
      backupData[table] = await readDb.all(`SELECT * FROM ${table}`);
    }
  }

  res.json({
    success: true,
    exported_at: new Date().toISOString(),
    version: 2,
    data: backupData
  });
}));
  // Shifts
  app.get("/api/shifts/current", asyncHandler(async (req, res) => {
    const openShift = await getOpenShift();

    res.json({
      success: true,
      shift: openShift || null
    });
  }));

  app.post("/api/shifts/open", asyncHandler(async (req, res) => {
  const { user_id, opening_balance, opening_note, currency_code } = req.body;

  const safeUserId = Number(user_id);
  const safeOpeningBalanceOriginal = Number(opening_balance || 0);
  const safeCurrencyCode = String(currency_code || "USD").toUpperCase();
  const safeExchangeRate = await getRateFromUSD(safeCurrencyCode);
  const safeOpeningBalanceBase =
    safeExchangeRate > 0 ? safeOpeningBalanceOriginal / safeExchangeRate : safeOpeningBalanceOriginal;

  if (!safeUserId || Number.isNaN(safeUserId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المستخدم غير صالح"
    });
  }

  if (!Number.isFinite(safeOpeningBalanceOriginal) || safeOpeningBalanceOriginal < 0) {
    return res.status(400).json({
      success: false,
      message: "رصيد بداية الوردية غير صالح"
    });
  }

  const user = await readDb.get(
    "SELECT id, username, full_name, role FROM users WHERE id = ?",
    safeUserId
  ) as any;

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "المستخدم غير موجود"
    });
  }

  const existingOpenShift = await getOpenShift();
  if (existingOpenShift) {
    return res.status(400).json({
      success: false,
      message: `توجد وردية مفتوحة بالفعل باسم ${existingOpenShift.user_name || existingOpenShift.username || "مستخدم آخر"}`
    });
  }

  const result = await enqueueWrite(() =>
    writeDb.run(
      `
      INSERT INTO shifts (
        user_id,
        currency_code,
        exchange_rate,
        opening_balance,
        opening_balance_original,
        opening_note,
        status,
        opened_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      safeUserId,
      safeCurrencyCode,
      safeExchangeRate,
      safeOpeningBalanceBase,
      safeOpeningBalanceOriginal,
      opening_note || null
    )
  );

  const newShift = await readDb.get(
    `
    SELECT sh.*, u.full_name as user_name, u.username
    FROM shifts sh
    LEFT JOIN users u ON u.id = sh.user_id
    WHERE sh.id = ?
    `,
    result.lastID
  );

  res.json({
    success: true,
    message: "تم فتح الوردية بنجاح",
    shift: newShift
  });
}));
  app.post("/api/shifts/close", asyncHandler(async (req, res) => {
  const { user_id, closing_cash_counted, closing_note } = req.body;

  const safeUserId = Number(user_id);
  const countedCashOriginal = Number(closing_cash_counted || 0);

  if (!safeUserId || Number.isNaN(safeUserId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المستخدم غير صالح"
    });
  }

  if (!Number.isFinite(countedCashOriginal) || countedCashOriginal < 0) {
    return res.status(400).json({
      success: false,
      message: "المبلغ الموجود فعليًا بالصندوق غير صالح"
    });
  }

  const openShift = await getOpenShift() as any;

  if (!openShift) {
    return res.status(404).json({
      success: false,
      message: "لا توجد وردية مفتوحة حاليًا"
    });
  }

  if (Number(openShift.user_id) !== safeUserId) {
    return res.status(403).json({
      success: false,
      message: "لا يمكنك إغلاق وردية مستخدم آخر"
    });
  }

  const summary = await calculateShiftSummary(Number(openShift.id));
  const exchangeRate = Number(openShift.exchange_rate || 1);
  const openingBalanceBase = Number(openShift.opening_balance || 0);

  const countedCashBase =
    exchangeRate > 0 ? countedCashOriginal / exchangeRate : countedCashOriginal;

  const expectedCashBase = openingBalanceBase + Number(summary.cash_sales || 0);
  const differenceBase = countedCashBase - expectedCashBase;

  const expectedCashOriginal = expectedCashBase * exchangeRate;
  const differenceOriginal = differenceBase * exchangeRate;

  await enqueueWrite(() =>
    writeDb.run(
      `
      UPDATE shifts
      SET
        closing_cash_counted = ?,
        closing_cash_counted_original = ?,
        expected_cash = ?,
        expected_cash_original = ?,
        difference = ?,
        difference_original = ?,
        closing_note = ?,
        status = 'closed',
        closed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      countedCashBase,
      countedCashOriginal,
      expectedCashBase,
      expectedCashOriginal,
      differenceBase,
      differenceOriginal,
      closing_note || null,
      openShift.id
    )
  );

  const closedShift = await readDb.get(
    `
    SELECT sh.*, u.full_name as user_name, u.username
    FROM shifts sh
    LEFT JOIN users u ON u.id = sh.user_id
    WHERE sh.id = ?
    `,
    openShift.id
  );

  res.json({
    success: true,
    message: "تم إغلاق الوردية بنجاح",
    shift: closedShift,
    summary: {
      ...summary,
      currency_code: openShift.currency_code || "USD",
      exchange_rate: exchangeRate,
      opening_balance_original: Number(openShift.opening_balance_original || 0),
      expected_cash_original: expectedCashOriginal,
      closing_cash_counted_original: countedCashOriginal,
      difference_original: differenceOriginal
    }
  });
}));
  app.get("/api/shifts", asyncHandler(async (req, res) => {
  const shifts = await readDb.all(`
    SELECT
      sh.*,
      u.full_name as user_name,
      u.username
    FROM shifts sh
    LEFT JOIN users u ON u.id = sh.user_id
    ORDER BY sh.id DESC
    LIMIT 100
  `);

  res.json({
    success: true,
    shifts: Array.isArray(shifts) ? shifts : []
  });
}));
  // Restore
app.post("/api/restore", asyncHandler(async (req, res) => {
  const payload = req.body;
  const backupData = payload?.data ?? payload;

  const validationError = validateBackupShape(backupData);
  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError
    });
  }

  await enqueueWrite(async () => {
    await writeDb.exec("PRAGMA foreign_keys = OFF;");
    try {
      await writeDb.exec("BEGIN IMMEDIATE TRANSACTION");
      try {
        for (const table of deleteOrder) {
          await writeDb.run(`DELETE FROM ${table}`);
        }

        await writeDb.run("DELETE FROM sqlite_sequence");

        for (const table of insertOrder) {
          const rows = backupData[table];

          if (table === "settings") {
            if (Array.isArray(rows)) {
              for (const row of rows) {
                await writeDb.run(
                  "INSERT INTO settings (key, value) VALUES (?, ?)",
                  row.key,
                  String(row.value ?? "")
                );
              }
            } else if (isPlainObject(rows)) {
              for (const [key, value] of Object.entries(rows)) {
                await writeDb.run(
                  "INSERT INTO settings (key, value) VALUES (?, ?)",
                  key,
                  String(value ?? "")
                );
              }
            }
            continue;
          }

          if (!Array.isArray(rows) || rows.length === 0) continue;

          for (const row of rows) {
            const columns = Object.keys(row);
            if (columns.length === 0) continue;

            const placeholders = columns.map(() => "?").join(", ");
            const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
            const values = columns.map((col) => row[col]);

            await writeDb.run(sql, ...values);
          }
        }

        await writeDb.exec("COMMIT");
      } catch (error) {
        try {
          await writeDb.exec("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Rollback failed during restore:", rollbackErr);
        }
        throw error;
      }
    } finally {
      await writeDb.exec("PRAGMA foreign_keys = ON;");
    }
  });

  const usersRows = Array.isArray(backupData.users) ? backupData.users : [];

  await enqueueWrite(async () => {
    await authWriteDb.exec("PRAGMA foreign_keys = OFF;");
    try {
      await authWriteDb.exec("BEGIN IMMEDIATE TRANSACTION");
      try {
        await authWriteDb.run("DELETE FROM users");
        await authWriteDb.run("DELETE FROM sqlite_sequence WHERE name = ?", "users");

        for (const rawRow of usersRows) {
          const row = { ...rawRow };

          if ("password" in row) {
            row.password = await hashPasswordIfNeeded(String(row.password ?? ""));
          }

          if (row.username === "admin") {
            row.is_protected_admin = 1;
          } else if (!("is_protected_admin" in row)) {
            row.is_protected_admin = 0;
          }

          const columns = Object.keys(row);
          if (columns.length === 0) continue;

          const placeholders = columns.map(() => "?").join(", ");
          const sql = `INSERT INTO users (${columns.join(", ")}) VALUES (${placeholders})`;
          const values = columns.map((col) => row[col]);

          await authWriteDb.run(sql, ...values);
        }

        await authWriteDb.run(
          "UPDATE users SET is_protected_admin = 1 WHERE username = ?",
          "admin"
        );

        await authWriteDb.exec("COMMIT");
      } catch (error) {
        try {
          await authWriteDb.exec("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Rollback failed during auth restore:", rollbackErr);
        }
        throw error;
      }
    } finally {
      await authWriteDb.exec("PRAGMA foreign_keys = ON;");
    }
  });
await syncAllAuthUsersToMainDb();
  res.json({
    success: true,
    message: "تمت استعادة البيانات بنجاح"
  });
}));

  // Reset all app data
app.delete("/api/reset-all", asyncHandler(async (req, res) => {
  await enqueueWrite(async () => {
    await writeDb.exec("PRAGMA foreign_keys = OFF;");
    try {
      await writeDb.exec("BEGIN IMMEDIATE TRANSACTION");
      try {
        for (const table of deleteOrder) {
          await writeDb.run(`DELETE FROM ${table}`);
        }

        for (const table of deleteOrder) {
          await writeDb.run("DELETE FROM sqlite_sequence WHERE name = ?", table);
        }

        for (const s of getDefaultSettings()) {
          await writeDb.run(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            s.key,
            s.value
          );
        }

        const initialCategories = [
          "مواد غذائية",
          "منظفات",
          "مشروبات",
          "أدوية ومستحضرات صحية",
          "خضروات وفواكه",
          "ألبان وأجبان",
          "دخان"
        ];

        for (const categoryName of initialCategories) {
          await writeDb.run("INSERT INTO categories (name) VALUES (?)", categoryName);
        }

        await writeDb.exec("COMMIT");
      } catch (error) {
        try {
          await writeDb.exec("ROLLBACK");
        } catch (rollbackErr) {
          console.error("Rollback failed during reset-all:", rollbackErr);
        }
        throw error;
      }
    } finally {
      await writeDb.exec("PRAGMA foreign_keys = ON;");
    }
  });

  res.json({
    success: true,
    message: "تم مسح جميع البيانات التشغيلية مع الإبقاء على المستخدمين"
  });
}));
// eshtirak
  app.get("/api/subscription-status", asyncHandler(async (req, res) => {
    const status = await getSubscriptionStatus();
    res.json({
      success: true,
      ...status
    });
  }));
 app.post("/api/subscription/redeem", asyncHandler(async (req, res) => {
  const rawCode = String(req.body?.renewal_code || "").trim();
  const codeConfig = RENEWAL_CODES[rawCode];

  if (!rawCode) {
    return res.status(400).json({
      success: false,
      message: "يرجى إدخال رمز التجديد"
    });
  }

  if (!codeConfig) {
    return res.status(400).json({
      success: false,
      message: "رمز التجديد غير صحيح"
    });
  }

  const currentSubscription = await getCurrentSubscription();
  const now = new Date();

  let baseDate = now;

  if (currentSubscription?.expires_at) {
    const currentExpiry = new Date(currentSubscription.expires_at);
    if (!Number.isNaN(currentExpiry.getTime()) && currentExpiry.getTime() > now.getTime()) {
      baseDate = currentExpiry;
    }
  }

  let expiresAt = new Date(baseDate);

  if (codeConfig.license_type === "trial") {
    expiresAt = addMinutes(now, codeConfig.minutes || 10);
  } else {
    expiresAt = addYears(baseDate, codeConfig.years || 1);
  }

 const startsAt = currentSubscription?.starts_at || now.toISOString();

  const deviceFingerprint = getDeviceFingerprint();

writeLicenseFile({
  license_type: codeConfig.license_type,
  starts_at: startsAt,
  expires_at: expiresAt.toISOString(),
  is_active: 1,
  notes: codeConfig.note,
  device_fingerprint: deviceFingerprint
});

await runTransaction(async () => {
  await writeDb.run("DELETE FROM subscriptions");

  await writeDb.run(
    `
    INSERT INTO subscriptions
    (license_type, starts_at, expires_at, is_active, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    codeConfig.license_type,
    startsAt,
    expiresAt.toISOString(),
    1,
    codeConfig.note
  );
});

  const status = await getSubscriptionStatus();

  res.json({
    success: true,
    message: codeConfig.successMessage,
    ...status
  });
}));
  // Auth
  app.post("/api/login", asyncHandler(async (req, res) => {
    const { username, password } = req.body;

   const user = (await authReadDb.get(
  "SELECT id, username, password, full_name, role FROM users WHERE username = ?",
  username
)) as any;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "اسم المستخدم أو كلمة المرور غير صحيحة"
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  }));

  // Products
  app.get("/api/products", asyncHandler(async (req, res) => {
    const products = await readDb.all(`
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.id DESC
    `);
    res.json(products);
  }));

  app.get("/api/products/:barcode", asyncHandler(async (req, res) => {
    const product = await readDb.get("SELECT * FROM products WHERE barcode = ?", req.params.barcode);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: "المنتج غير موجود" });
    }
  }));

  app.post("/api/products", asyncHandler(async (req, res) => {
    const {
      barcode,
      name,
      category_id,
      unit,
      purchase_price,
      sale_price,
      stock_quantity,
      min_stock_level,
      expiry_date,
      image_url,
      supplier_id,
      notes
    } = req.body;

    const result = await enqueueWrite(() =>
      writeDb.run(
        `
        INSERT INTO products (barcode, name, category_id, unit, purchase_price, sale_price, stock_quantity, min_stock_level, expiry_date, image_url, supplier_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        barcode,
        name,
        category_id,
        unit,
        purchase_price,
        sale_price,
        stock_quantity,
        min_stock_level,
        expiry_date,
        image_url,
        supplier_id,
        notes
      )
    );

    res.json({ success: true, id: result.lastID });
  }));

  app.put("/api/products/:id", asyncHandler(async (req, res) => {
    const {
      barcode,
      name,
      category_id,
      unit,
      purchase_price,
      sale_price,
      stock_quantity,
      min_stock_level,
      expiry_date,
      image_url,
      supplier_id,
      notes
    } = req.body;

    await enqueueWrite(() =>
      writeDb.run(
        `
        UPDATE products
        SET barcode=?, name=?, category_id=?, unit=?, purchase_price=?, sale_price=?, stock_quantity=?, min_stock_level=?, expiry_date=?, image_url=?, supplier_id=?, notes=?
        WHERE id=?
      `,
        barcode,
        name,
        category_id,
        unit,
        purchase_price,
        sale_price,
        stock_quantity,
        min_stock_level,
        expiry_date,
        image_url,
        supplier_id,
        notes,
        req.params.id
      )
    );

    res.json({ success: true });
  }));

  app.delete("/api/products/:id", asyncHandler(async (req, res) => {
    const productId = req.params.id;

    const product = (await readDb.get(
      "SELECT id, name, stock_quantity FROM products WHERE id = ?",
      productId
    )) as any;

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "المنتج غير موجود"
      });
    }

    if (Number(product.stock_quantity) > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف منتجات موجودة في المخزون"
      });
    }

    const salesCount = await readDb.get(
      "SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?",
      productId
    ) as any;

    if (Number(salesCount?.count || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف المنتج لأنه مرتبط بفواتير مبيعات"
      });
    }

    const purchasesCount = await readDb.get(
      "SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?",
      productId
    ) as any;

    if (Number(purchasesCount?.count || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف المنتج لأنه مرتبط بفواتير مشتريات"
      });
    }

    await enqueueWrite(() => writeDb.run("DELETE FROM products WHERE id = ?", productId));

    res.json({
      success: true,
      message: "تم حذف المنتج بنجاح"
    });
  }));

app.post("/api/products/bulk", asyncHandler(async (req, res) => {
  const products = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({
      success: false,
      message: "يجب إرسال مصفوفة من المنتجات"
    });
  }

  const normalizeValue = (value: any) =>
    String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

  const totalRows = products.length;
  let inserted = 0;
  let ignored = 0;

  const ignoredRows: Array<{
    row_number: number;
    name: string;
    barcode: string;
    reason: string;
  }> = [];

  const seenPairsInFile = new Set<string>();

  await runTransaction(async () => {
    for (let index = 0; index < products.length; index++) {
      const p = products[index];

      const safeName = String(p.name ?? "").trim();
      const safeBarcode = String(p.barcode ?? "").trim();

      if (!safeName || !safeBarcode) {
        ignored++;
        ignoredRows.push({
          row_number: index + 1,
          name: safeName,
          barcode: safeBarcode,
          reason: "الاسم أو الباركود فارغ"
        });
        continue;
      }

      const pairKey = `${normalizeValue(safeName)}__${normalizeValue(safeBarcode)}`;

      if (seenPairsInFile.has(pairKey)) {
        ignored++;
        ignoredRows.push({
          row_number: index + 1,
          name: safeName,
          barcode: safeBarcode,
          reason: "مكرر داخل ملف الاستيراد"
        });
        continue;
      }

      seenPairsInFile.add(pairKey);

      const existingProduct = await writeDb.get(
        `
        SELECT id
        FROM products
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
          AND LOWER(TRIM(barcode)) = LOWER(TRIM(?))
        LIMIT 1
        `,
        safeName,
        safeBarcode
      );

      if (existingProduct) {
        ignored++;
        ignoredRows.push({
          row_number: index + 1,
          name: safeName,
          barcode: safeBarcode,
          reason: "موجود مسبقًا في قاعدة البيانات"
        });
        continue;
      }

      const result = await writeDb.run(
        `
        INSERT INTO products
        (barcode, name, category_id, unit, purchase_price, sale_price, stock_quantity, min_stock_level, expiry_date, image_url, supplier_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        safeBarcode,
        safeName,
        p.category_id ?? null,
        p.unit ?? null,
        Number(p.purchase_price ?? 0),
        Number(p.sale_price ?? 0),
        Number(p.stock_quantity ?? 0),
        Number(p.min_stock_level ?? 5),
        p.expiry_date ?? null,
        p.image_url ?? null,
        p.supplier_id ?? null,
        p.notes ?? null
      );

      if ((result?.changes || 0) > 0) {
        inserted++;
      } else {
        ignored++;
        ignoredRows.push({
          row_number: index + 1,
          name: safeName,
          barcode: safeBarcode,
          reason: "لم يتم الإدخال"
        });
      }
    }
  });

  res.json({
    success: true,
    total_rows: totalRows,
    inserted_rows: inserted,
    ignored_rows: ignored,
    ignored_details: ignoredRows,
    message:
      ignored > 0
        ? `تم استيراد ${inserted} من أصل ${totalRows} صف، وتم تجاهل ${ignored} صف مكرر أو غير صالح`
        : `تم استيراد ${inserted} من أصل ${totalRows} صف بنجاح`
  });
}));
  // Local Image Proxy
  app.get("/api/local-image", asyncHandler(async (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).send("Path is required");
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(__dirname, filePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).send("Image not found");
    }

    res.sendFile(absolutePath);
  }));

  // Categories
  app.get("/api/categories", asyncHandler(async (req, res) => {
    res.json(await readDb.all("SELECT * FROM categories ORDER BY id DESC"));
  }));

  // Suppliers
app.get("/api/suppliers/:id/statement", asyncHandler(async (req, res) => {
  const supplierId = Number(req.params.id);

  if (!supplierId || Number.isNaN(supplierId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المورد غير صالح"
    });
  }

  const supplier = await readDb.get(
    "SELECT id, name, phone, address, balance FROM suppliers WHERE id = ?",
    supplierId
  ) as any;

  if (!supplier) {
    return res.status(404).json({
      success: false,
      message: "المورد غير موجود"
    });
  }

  const transactions = await readDb.all(
    `
    SELECT
      t.id,
      t.transaction_type,
      t.reference_id,
      t.reference_type,
      COALESCE(t.debit_amount, 0) as debit_amount,
      COALESCE(t.credit_amount, 0) as credit_amount,
      COALESCE(t.balance_after, 0) as balance_after,
      t.amount_original,
      t.currency_code,
      t.exchange_rate,
      t.note,
      t.created_at,
      COALESCE(u.full_name, '-') as user_name
    FROM supplier_account_transactions t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.supplier_id = ?
    ORDER BY datetime(t.created_at) ASC, t.id ASC
    `,
    supplierId
  );

  const totals = await readDb.get(
    `
    SELECT
      COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN debit_amount ELSE 0 END), 0) as total_purchases,
      COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN credit_amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as total_remaining,
      COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN 1 ELSE 0 END), 0) as purchase_count,
      COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN 1 ELSE 0 END), 0) as payments_count
    FROM supplier_account_transactions
    WHERE supplier_id = ?
    `,
    supplierId
  ) as any;

  res.json({
    success: true,
    supplier,
    transactions: Array.isArray(transactions) ? transactions : [],
    totals: {
      total_purchases: Number(totals?.total_purchases || 0),
      total_paid: Number(totals?.total_paid || 0),
      total_remaining: Number(totals?.total_remaining || 0),
      current_balance: Number(supplier.balance || 0),
      purchase_count: Number(totals?.purchase_count || 0),
      payments_count: Number(totals?.payments_count || 0)
    }
  });
}));



  

  app.put("/api/suppliers/:id", asyncHandler(async (req, res) => {
  const { name, phone, address, balance } = req.body;

  const existingSupplier = await readDb.get(
    "SELECT * FROM suppliers WHERE id = ?",
    req.params.id
  ) as any;

  if (!existingSupplier) {
    return res.status(404).json({
      success: false,
      message: "المورد غير موجود"
    });
  }

  await enqueueWrite(() =>
    writeDb.run(
      `
      UPDATE suppliers
      SET name = ?, phone = ?, address = ?, balance = ?
      WHERE id = ?
      `,
      name ?? existingSupplier.name,
      phone ?? existingSupplier.phone,
      address ?? existingSupplier.address,
      balance ?? existingSupplier.balance,
      req.params.id
    )
  );

  res.json({ success: true });
}));


  app.delete("/api/suppliers/:id", asyncHandler(async (req, res) => {
    const supplierId = req.params.id;

    const purchaseCount = (await readDb.get(
      "SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?",
      supplierId
    )) as any;

    const linkedProducts = (await readDb.get(
      "SELECT COUNT(*) as count FROM products WHERE supplier_id = ?",
      supplierId
    )) as any;

    const supplier = (await readDb.get(
      "SELECT balance FROM suppliers WHERE id = ?",
      supplierId
    )) as any;

    if (!supplier) {
      return res.status(404).json({ success: false, message: "المورد غير موجود" });
    }

    if ((purchaseCount?.count || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف المورد لأنه مرتبط بفواتير شراء"
      });
    }

    if ((linkedProducts?.count || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف المورد لأنه مرتبط بمنتجات"
      });
    }

    if (Number(supplier.balance || 0) !== 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف المورد لأن رصيده ليس صفراً"
      });
    }

    await enqueueWrite(() => writeDb.run("DELETE FROM suppliers WHERE id = ?", supplierId));
    res.json({ success: true });
  }));
// suppliers
 // Suppliers
app.get("/api/suppliers", asyncHandler(async (req, res) => {
  res.json(await readDb.all("SELECT * FROM suppliers ORDER BY id DESC"));
}));

app.post("/api/suppliers", asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;

  const result = await enqueueWrite(() =>
    writeDb.run(
      "INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)",
      name,
      phone,
      address
    )
  );

  res.json({ success: true, id: result.lastID });
}));

app.get("/api/suppliers/:id/statement", asyncHandler(async (req, res) => {
  const supplierId = Number(req.params.id);

  if (!supplierId || Number.isNaN(supplierId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المورد غير صالح"
    });
  }

  const supplier = await readDb.get(
    "SELECT id, name, phone, address, balance FROM suppliers WHERE id = ?",
    supplierId
  ) as any;

  if (!supplier) {
    return res.status(404).json({
      success: false,
      message: "المورد غير موجود"
    });
  }

  const transactions = await readDb.all(
    `
    SELECT
      t.id,
      t.transaction_type,
      t.reference_id,
      t.reference_type,
      COALESCE(t.debit_amount, 0) as debit_amount,
      COALESCE(t.credit_amount, 0) as credit_amount,
      COALESCE(t.balance_after, 0) as balance_after,
      t.amount_original,
      t.currency_code,
      t.exchange_rate,
      t.note,
      t.created_at,
      COALESCE(u.full_name, '-') as user_name
    FROM supplier_account_transactions t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.supplier_id = ?
    ORDER BY datetime(t.created_at) ASC, t.id ASC
    `,
    supplierId
  );

  const totals = await readDb.get(
    `
    SELECT
      COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN debit_amount ELSE 0 END), 0) as total_purchases,
      COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN credit_amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as total_remaining,
      COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN 1 ELSE 0 END), 0) as purchase_count,
      COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN 1 ELSE 0 END), 0) as payments_count
    FROM supplier_account_transactions
    WHERE supplier_id = ?
    `,
    supplierId
  ) as any;

  res.json({
    success: true,
    supplier,
    transactions: Array.isArray(transactions) ? transactions : [],
    totals: {
      total_purchases: Number(totals?.total_purchases || 0),
      total_paid: Number(totals?.total_paid || 0),
      total_remaining: Number(totals?.total_remaining || 0),
      current_balance: Number(supplier.balance || 0),
      purchase_count: Number(totals?.purchase_count || 0),
      payments_count: Number(totals?.payments_count || 0)
    }
  });
}));

app.post("/api/suppliers/:id/settle", asyncHandler(async (req, res) => {
  const supplierId = Number(req.params.id);
  const {
    amount,
    amount_original,
    currency_code,
    exchange_rate,
    note,
    user_id
  } = req.body;

  if (!supplierId || Number.isNaN(supplierId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المورد غير صالح"
    });
  }

  const result = await runTransaction(async () => {
    const supplier = await writeDb.get(
      "SELECT * FROM suppliers WHERE id = ?",
      supplierId
    ) as any;

    if (!supplier) {
      return {
        status: 404,
        body: { success: false, message: "المورد غير موجود" }
      };
    }

    const settleAmount = Number(amount || 0);
    const oldBalance = Number(supplier.balance || 0);

    if (settleAmount <= 0) {
      return {
        status: 400,
        body: { success: false, message: "مبلغ التسديد غير صالح" }
      };
    }

   

    const newBalance = oldBalance - settleAmount;

    await writeDb.run(
      "UPDATE suppliers SET balance = ? WHERE id = ?",
      newBalance,
      supplierId
    );

    const originalData =
      amount_original && currency_code
        ? {
            amount_original: Number(amount_original || 0),
            exchange_rate: Number(exchange_rate || 1),
            currency_code: String(currency_code || "USD")
          }
        : await calculateOriginalAmountFromBaseUSD(settleAmount, "USD");

    await writeDb.run(
      `
      INSERT INTO supplier_account_transactions
      (
        supplier_id,
        transaction_type,
        reference_id,
        reference_type,
        debit_amount,
        credit_amount,
        balance_after,
        amount_original,
        currency_code,
        exchange_rate,
        note,
        created_by
      )
      VALUES (?, 'payment', NULL, 'manual_payment', 0, ?, ?, ?, ?, ?, ?, ?)
      `,
      supplierId,
      settleAmount,
      newBalance,
      originalData.amount_original,
      originalData.currency_code,
      originalData.exchange_rate,
      note || "تسديد دين مورد",
      user_id || null
    );

    return {
      status: 200,
      body: {
        success: true,
        message:
  newBalance < 0
    ? "تم تسجيل التسديد وأصبح هناك رصيد لصالح المورد"
    : "تم تسديد دين المورد بنجاح"
      }
    };
  });

  return res.status(result.status).json(result.body);
}));

app.put("/api/suppliers/:id", asyncHandler(async (req, res) => {
  const supplierId = Number(req.params.id);
  const { name, phone, address, balance } = req.body;

  if (!supplierId || Number.isNaN(supplierId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المورد غير صالح"
    });
  }

  const existingSupplier = await readDb.get(
    "SELECT * FROM suppliers WHERE id = ?",
    supplierId
  ) as any;

  if (!existingSupplier) {
    return res.status(404).json({
      success: false,
      message: "المورد غير موجود"
    });
  }

  await enqueueWrite(() =>
    writeDb.run(
      `
      UPDATE suppliers
      SET name = ?, phone = ?, address = ?, balance = ?
      WHERE id = ?
      `,
      name ?? existingSupplier.name,
      phone ?? existingSupplier.phone,
      address ?? existingSupplier.address,
      balance ?? existingSupplier.balance,
      supplierId
    )
  );

  res.json({ success: true });
}));

app.delete("/api/suppliers/:id", asyncHandler(async (req, res) => {
  const supplierId = Number(req.params.id);

  if (!supplierId || Number.isNaN(supplierId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المورد غير صالح"
    });
  }

  const purchaseCount = (await readDb.get(
    "SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?",
    supplierId
  )) as any;

  const linkedProducts = (await readDb.get(
    "SELECT COUNT(*) as count FROM products WHERE supplier_id = ?",
    supplierId
  )) as any;

  const supplier = (await readDb.get(
    "SELECT balance FROM suppliers WHERE id = ?",
    supplierId
  )) as any;

  if (!supplier) {
    return res.status(404).json({ success: false, message: "المورد غير موجود" });
  }

  if ((purchaseCount?.count || 0) > 0) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف المورد لأنه مرتبط بفواتير شراء"
    });
  }

  if ((linkedProducts?.count || 0) > 0) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف المورد لأنه مرتبط بمنتجات"
    });
  }

  if (Number(supplier.balance || 0) !== 0) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف المورد لأن رصيده ليس صفراً"
    });
  }

  await enqueueWrite(() => writeDb.run("DELETE FROM suppliers WHERE id = ?", supplierId));
  res.json({ success: true });
}));


// Customers
app.get("/api/customers", asyncHandler(async (req, res) => {
  res.json(await readDb.all("SELECT * FROM customers ORDER BY id DESC"));
}));

app.post("/api/customers", asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;

  const result = await enqueueWrite(() =>
    writeDb.run(
      "INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)",
      name,
      phone,
      address
    )
  );

  res.json({ success: true, id: result.lastID });
}));

app.post("/api/customers/:id/settle", asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);
  const {
    amount,
    amount_original,
    currency_code,
    exchange_rate,
    note,
    user_id
  } = req.body;

  if (!customerId || Number.isNaN(customerId)) {
    return res.status(400).json({
      success: false,
      message: "معرف العميل غير صالح"
    });
  }

  const result = await runTransaction(async () => {
    const customer = await writeDb.get(
      "SELECT * FROM customers WHERE id = ?",
      customerId
    ) as any;

    if (!customer) {
      return {
        status: 404,
        body: { success: false, message: "العميل غير موجود" }
      };
    }

    const settleAmount = Number(amount || 0);
    const oldBalance = Number(customer.balance || 0);

    if (settleAmount <= 0) {
      return {
        status: 400,
        body: { success: false, message: "مبلغ التسديد غير صالح" }
      };
    }

   

    const newBalance = oldBalance - settleAmount;

    await writeDb.run(
      "UPDATE customers SET balance = ? WHERE id = ?",
      newBalance,
      customerId
    );

    const originalData =
      amount_original && currency_code
        ? {
            amount_original: Number(amount_original || 0),
            exchange_rate: Number(exchange_rate || 1),
            currency_code: String(currency_code || "USD")
          }
        : await calculateOriginalAmountFromBaseUSD(settleAmount, "USD");

    await writeDb.run(
      `
      INSERT INTO customer_account_transactions
      (
        customer_id,
        transaction_type,
        reference_id,
        reference_type,
        debit_amount,
        credit_amount,
        balance_after,
        amount_original,
        currency_code,
        exchange_rate,
        note,
        created_by
      )
      VALUES (?, 'payment', NULL, 'manual_payment', 0, ?, ?, ?, ?, ?, ?, ?)
      `,
      customerId,
      settleAmount,
      newBalance,
      originalData.amount_original,
      originalData.currency_code,
      originalData.exchange_rate,
      note || "تسديد دين عميل",
      user_id || null
    );

    return {
      status: 200,
      body: {
        success: true,
        message:
  newBalance < 0
    ? "تم تسجيل التسديد وأصبح هناك رصيد لصالح العميل"
    : "تم تسديد دين العميل بنجاح"
      }
    };
  });

  return res.status(result.status).json(result.body);
}));

app.put("/api/customers/:id", asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);
  const { name, phone, address, balance } = req.body;

  if (!customerId || Number.isNaN(customerId)) {
    return res.status(400).json({
      success: false,
      message: "معرف العميل غير صالح"
    });
  }

  const existingCustomer = await readDb.get(
    "SELECT * FROM customers WHERE id = ?",
    customerId
  ) as any;

  if (!existingCustomer) {
    return res.status(404).json({
      success: false,
      message: "العميل غير موجود"
    });
  }

  await enqueueWrite(() =>
    writeDb.run(
      `
      UPDATE customers
      SET name = ?, phone = ?, address = ?, balance = ?
      WHERE id = ?
      `,
      name ?? existingCustomer.name,
      phone ?? existingCustomer.phone,
      address ?? existingCustomer.address,
      balance ?? existingCustomer.balance,
      customerId
    )
  );

  res.json({ success: true });
}));

app.delete("/api/customers/:id", asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);

  if (!customerId || Number.isNaN(customerId)) {
    return res.status(400).json({
      success: false,
      message: "معرف العميل غير صالح"
    });
  }

  const salesCount = (await readDb.get(
    "SELECT COUNT(*) as count FROM sales WHERE customer_id = ?",
    customerId
  )) as any;

  const customer = (await readDb.get(
    "SELECT balance FROM customers WHERE id = ?",
    customerId
  )) as any;

  if (!customer) {
    return res.status(404).json({ success: false, message: "العميل غير موجود" });
  }

  if ((salesCount?.count || 0) > 0) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف العميل لأنه مرتبط بفواتير مبيعات"
    });
  }

  if (Number(customer.balance || 0) !== 0) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف العميل لأن رصيده ليس صفراً"
    });
  }

  await enqueueWrite(() => writeDb.run("DELETE FROM customers WHERE id = ?", customerId));
  res.json({ success: true });
}));

app.get("/api/customers/:id/statement", asyncHandler(async (req, res) => {
  const customerId = Number(req.params.id);

  if (!customerId || Number.isNaN(customerId)) {
    return res.status(400).json({
      success: false,
      message: "معرف العميل غير صالح"
    });
  }

  const customer = await readDb.get(
    "SELECT id, name, phone, address, balance FROM customers WHERE id = ?",
    customerId
  ) as any;

  if (!customer) {
    return res.status(404).json({
      success: false,
      message: "العميل غير موجود"
    });
  }

  const transactions = await readDb.all(
    `
    SELECT
      t.id,
      t.transaction_type,
      t.reference_id,
      t.reference_type,
      COALESCE(t.debit_amount, 0) as debit_amount,
      COALESCE(t.credit_amount, 0) as credit_amount,
      COALESCE(t.balance_after, 0) as balance_after,
      t.amount_original,
      t.currency_code,
      t.exchange_rate,
      t.note,
      t.created_at,
      COALESCE(u.full_name, '-') as user_name
    FROM customer_account_transactions t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.customer_id = ?
    ORDER BY datetime(t.created_at) ASC, t.id ASC
    `,
    customerId
  );

  const totals = await readDb.get(
    `
    SELECT
      COALESCE(SUM(CASE WHEN transaction_type = 'sale' THEN debit_amount ELSE 0 END), 0) as total_sales,
      COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN credit_amount ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as total_remaining,
      COALESCE(SUM(CASE WHEN transaction_type = 'sale' THEN 1 ELSE 0 END), 0) as sales_count,
      COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN 1 ELSE 0 END), 0) as payments_count
    FROM customer_account_transactions
    WHERE customer_id = ?
    `,
    customerId
  ) as any;

  res.json({
    success: true,
    customer,
    transactions: Array.isArray(transactions) ? transactions : [],
    totals: {
      total_sales: Number(totals?.total_sales || 0),
      total_paid: Number(totals?.total_paid || 0),
      total_remaining: Number(totals?.total_remaining || 0),
      current_balance: Number(customer.balance || 0),
      sales_count: Number(totals?.sales_count || 0),
      payments_count: Number(totals?.payments_count || 0)
    }
  });
}));

  // Sales
app.post("/api/sales", asyncHandler(async (req, res) => {
  const { customer_id, total_amount, discount, paid_amount, payment_method, user_id, items } = req.body;

  const saleId = await runTransaction(async () => {
   const settings = await getSettingsObject();
const shiftsEnabled = String(settings?.enable_shifts || "false") === "true";

let shiftId: number | null = null;

if (shiftsEnabled) {
  const openShift = await writeDb.get(
    `
    SELECT id, user_id, status
    FROM shifts
    WHERE status = 'open'
    ORDER BY id DESC
    LIMIT 1
    `
  ) as any;

  if (!openShift) {
    throw new Error("لا توجد وردية مفتوحة. يجب فتح وردية قبل إجراء أي عملية بيع");
  }

  if (Number(openShift.user_id) !== Number(user_id)) {
    throw new Error("لا يمكنك إجراء البيع على وردية مستخدم آخر");
  }

  shiftId = Number(openShift.id);
}

    for (const item of items) {
      const product = (await writeDb.get(
        "SELECT id, name, unit, stock_quantity FROM products WHERE id = ?",
        item.product_id
      )) as any;

      if (!product) {
        throw new Error("المنتج غير موجود");
      }

      const itemQuantity = Number(item.quantity || 0);

      if (itemQuantity <= 0) {
        throw new Error(`الكمية غير صالحة للمنتج "${product.name}"`);
      }

      if (Number(product.stock_quantity) < itemQuantity) {
        throw new Error(`الكمية المطلوبة من "${product.name}" غير متوفرة. المتاح: ${product.stock_quantity}`);
      }
    }

   const saleResult = await writeDb.run(
  `
  INSERT INTO sales (customer_id, total_amount, discount, paid_amount, payment_method, user_id, shift_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  customer_id,
  total_amount,
  discount,
  paid_amount,
  payment_method,
  user_id,
  shiftId
);

    const newSaleId = saleResult.lastID;

    for (const item of items) {
      await writeDb.run(
        `
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
        `,
        newSaleId,
        item.product_id,
        item.quantity,
        item.unit_price,
        item.total_price
      );

      const updateStock = await writeDb.run(
        `
        UPDATE products
        SET stock_quantity = stock_quantity - ?
        WHERE id = ? AND stock_quantity >= ?
        `,
        item.quantity,
        item.product_id,
        item.quantity
      );

      if ((updateStock?.changes || 0) === 0) {
        throw new Error("فشل تحديث المخزون بسبب تعارض في البيانات، حاول مرة أخرى");
      }
    }

    if (customer_id) {
      const remaining = Number(total_amount) - Number(discount || 0) - Number(paid_amount || 0);

      if (remaining > 0) {
        const currentCustomer = await writeDb.get(
          "SELECT balance FROM customers WHERE id = ?",
          customer_id
        ) as any;

        const oldBalance = Number(currentCustomer?.balance || 0);
        const newBalance = oldBalance + remaining;

        await writeDb.run(
          "UPDATE customers SET balance = ? WHERE id = ?",
          newBalance,
          customer_id
        );

        const saleCurrency = String(req.body.sale_currency || "USD");
        const rate = await getRateFromUSD(saleCurrency);

        await writeDb.run(
          `
          INSERT INTO customer_account_transactions
          (
            customer_id,
            transaction_type,
            reference_id,
            reference_type,
            debit_amount,
            credit_amount,
            balance_after,
            amount_original,
            currency_code,
            exchange_rate,
            note,
            created_by
          )
          VALUES (?, 'sale', ?, 'sale', ?, 0, ?, ?, ?, ?, ?, ?)
          `,
          customer_id,
          newSaleId,
          remaining,
          newBalance,
          remaining * rate,
          saleCurrency,
          rate,
          "ناتج عن فاتورة مبيعات",
          user_id || null
        );
      }
    }

    return newSaleId;
  });

  res.json({ success: true, saleId });
}));

  app.get("/api/sales", asyncHandler(async (req, res) => {
    const sales = await readDb.all(`
  SELECT
    s.*,
    c.name as customer_name,
    u.full_name as user_name,
    sh.opened_at as shift_opened_at,
    sh.closed_at as shift_closed_at,
    sh.status as shift_status,
    su.full_name as shift_user_name
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN users u ON s.user_id = u.id
  LEFT JOIN shifts sh ON s.shift_id = sh.id
  LEFT JOIN users su ON sh.user_id = su.id
  ORDER BY s.created_at DESC
`);
    res.json(sales);
  }));
app.get("/api/sales/:id/return-context", asyncHandler(async (req, res) => {
  const saleId = Number(req.params.id);

  if (!saleId || Number.isNaN(saleId)) {
    return res.status(400).json({
      success: false,
      message: "معرف الفاتورة غير صالح"
    });
  }

  const sale = await readDb.get(
    `
    SELECT
      s.*,
      c.name as customer_name,
      c.phone as customer_phone,
      c.balance as customer_balance,
      u.full_name as user_name,
      sh.opened_at as shift_opened_at,
      sh.closed_at as shift_closed_at,
      sh.status as shift_status,
      sh.opening_balance as shift_opening_balance,
      su.full_name as shift_user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN shifts sh ON s.shift_id = sh.id
    LEFT JOIN users su ON sh.user_id = su.id
    WHERE s.id = ?
    `,
    saleId
  ) as any;

  if (!sale) {
    return res.status(404).json({
      success: false,
      message: "الفاتورة غير موجودة"
    });
  }

  const items = await readDb.all(
    `
    SELECT
      si.id,
      si.sale_id,
      si.product_id,
      si.quantity,
      si.unit_price,
      si.total_price,
      p.name as product_name,
      p.barcode as product_barcode,
      p.unit as product_unit,
      p.stock_quantity as current_stock_quantity,
      COALESCE((
        SELECT SUM(sri.quantity)
        FROM sales_return_items sri
        INNER JOIN sales_returns sr ON sr.id = sri.return_id
        WHERE sri.sale_item_id = si.id
          AND sr.sale_id = si.sale_id
      ), 0) as returned_quantity
    FROM sale_items si
    LEFT JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = ?
    ORDER BY si.id ASC
    `,
    saleId
  ) as any[];

  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
    const soldQuantity = Number(item.quantity || 0);
    const returnedQuantity = Number(item.returned_quantity || 0);
    const remainingQuantity = Math.max(0, soldQuantity - returnedQuantity);

    return {
      ...item,
      quantity: soldQuantity,
      returned_quantity: returnedQuantity,
      remaining_quantity: remainingQuantity,
      is_fully_returned: remainingQuantity <= 0
    };
  });

  const previousReturns = await readDb.all(
    `
    SELECT
      sr.id,
      sr.sale_id,
      sr.customer_id,
      sr.user_id,
      sr.shift_id,
      sr.return_date,
      sr.reason,
      sr.return_method,
      sr.notes,
      sr.total_amount,
      sr.created_at,
      u.full_name as user_name
    FROM sales_returns sr
    LEFT JOIN users u ON u.id = sr.user_id
    WHERE sr.sale_id = ?
    ORDER BY datetime(sr.created_at) DESC, sr.id DESC
    `,
    saleId
  );

  const totals = normalizedItems.reduce(
    (acc, item) => {
      acc.sold_quantity += Number(item.quantity || 0);
      acc.returned_quantity += Number(item.returned_quantity || 0);
      acc.remaining_quantity += Number(item.remaining_quantity || 0);
      return acc;
    },
    {
      sold_quantity: 0,
      returned_quantity: 0,
      remaining_quantity: 0
    }
  );

  res.json({
    success: true,
    sale,
    items: normalizedItems,
    previous_returns: Array.isArray(previousReturns) ? previousReturns : [],
    totals,
    can_create_return: normalizedItems.some((item) => Number(item.remaining_quantity || 0) > 0)
  });
}));
app.post("/api/sales/:id/returns", asyncHandler(async (req, res) => {
  const saleId = Number(req.params.id);
  const {
    items,
    reason,
    notes,
    return_method,
    user_id,
    return_currency
  } = req.body;

  const safeUserId = Number(user_id);
  const safeReturnMethod = String(return_method || "cash_refund");
  const allowedMethods = ["cash_refund", "debt_discount", "stock_only"];

  if (!saleId || Number.isNaN(saleId)) {
    return res.status(400).json({
      success: false,
      message: "معرف الفاتورة غير صالح"
    });
  }

  if (!safeUserId || Number.isNaN(safeUserId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المستخدم غير صالح"
    });
  }

  if (!allowedMethods.includes(safeReturnMethod)) {
    return res.status(400).json({
      success: false,
      message: "طريقة المرتجع غير صالحة"
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "يجب إرسال عنصر واحد على الأقل في المرتجع"
    });
  }

  const result = await runTransaction(async () => {
    const sale = await writeDb.get(
      `
      SELECT *
      FROM sales
      WHERE id = ?
      `,
      saleId
    ) as any;

    if (!sale) {
      return {
        status: 404,
        body: {
          success: false,
          message: "الفاتورة الأصلية غير موجودة"
        }
      };
    }

    const settings = await getSettingsObject();
    const shiftsEnabled = String(settings?.enable_shifts || "false") === "true";

    let shiftId: number | null = null;

    if (shiftsEnabled && safeReturnMethod === "cash_refund") {
      const openShift = await writeDb.get(
        `
        SELECT id, user_id, status
        FROM shifts
        WHERE status = 'open'
        ORDER BY id DESC
        LIMIT 1
        `
      ) as any;

      if (!openShift) {
        return {
          status: 400,
          body: {
            success: false,
            message: "لا توجد وردية مفتوحة. يجب فتح وردية قبل تنفيذ مرتجع نقدي"
          }
        };
      }

      if (Number(openShift.user_id) !== safeUserId) {
        return {
          status: 403,
          body: {
            success: false,
            message: "لا يمكنك تنفيذ المرتجع النقدي على وردية مستخدم آخر"
          }
        };
      }

      shiftId = Number(openShift.id);
    }

    const saleItems = await writeDb.all(
      `
      SELECT
        si.id,
        si.sale_id,
        si.product_id,
        si.quantity,
        si.unit_price,
        si.total_price,
        p.name as product_name,
        p.stock_quantity as current_stock_quantity
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
      `,
      saleId
    ) as any[];

    const saleItemsMap = new Map<number, any>();
    for (const row of saleItems) {
      saleItemsMap.set(Number(row.id), row);
    }

    const normalizedRequestItems = items.map((item: any) => ({
      sale_item_id: Number(item.sale_item_id),
      quantity: Number(item.quantity || 0)
    }));

    for (const item of normalizedRequestItems) {
      if (!item.sale_item_id || Number.isNaN(item.sale_item_id)) {
        return {
          status: 400,
          body: {
            success: false,
            message: "يوجد سطر مرتجع بدون sale_item_id صالح"
          }
        };
      }

      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        return {
          status: 400,
          body: {
            success: false,
            message: "يوجد سطر مرتجع بكمية غير صالحة"
          }
        };
      }

      const originalSaleItem = saleItemsMap.get(item.sale_item_id);

      if (!originalSaleItem) {
        return {
          status: 400,
          body: {
            success: false,
            message: "أحد عناصر المرتجع لا يعود إلى هذه الفاتورة"
          }
        };
      }

      const returnedRow = await writeDb.get(
        `
        SELECT
          COALESCE(SUM(sri.quantity), 0) as returned_quantity
        FROM sales_return_items sri
        INNER JOIN sales_returns sr ON sr.id = sri.return_id
        WHERE sri.sale_item_id = ?
          AND sr.sale_id = ?
        `,
        item.sale_item_id,
        saleId
      ) as any;

      const soldQuantity = Number(originalSaleItem.quantity || 0);
      const returnedQuantity = Number(returnedRow?.returned_quantity || 0);
      const remainingQuantity = Math.max(0, soldQuantity - returnedQuantity);

      if (item.quantity > remainingQuantity) {
        return {
          status: 400,
          body: {
            success: false,
            message: `الكمية المرتجعة للمنتج "${originalSaleItem.product_name}" أكبر من الكمية المتبقية المسموح بها`
          }
        };
      }
    }

    let returnTotalAmount = 0;

    for (const item of normalizedRequestItems) {
      const originalSaleItem = saleItemsMap.get(item.sale_item_id);
      const unitPrice = Number(originalSaleItem.unit_price || 0);
      returnTotalAmount += Number(item.quantity) * unitPrice;
    }

    if (safeReturnMethod === "debt_discount") {
      if (!sale.customer_id) {
        return {
          status: 400,
          body: {
            success: false,
            message: "لا يمكن خصم المرتجع من دين عميل غير محدد على الفاتورة"
          }
        };
      }

      const customer = await writeDb.get(
        "SELECT id, balance FROM customers WHERE id = ?",
        sale.customer_id
      ) as any;

      if (!customer) {
        return {
          status: 404,
          body: {
            success: false,
            message: "العميل المرتبط بالفاتورة غير موجود"
          }
        };
      }

      const currentBalance = Number(customer.balance || 0);

      // if (returnTotalAmount > currentBalance) {
      //   return {
      //     status: 400,
      //     body: {
      //       success: false,
      //       message: "قيمة المرتجع أكبر من دين العميل الحالي، لا يمكن تطبيق خصم من الدين"
      //     }
      //   };
      // }
    }

    const returnInsert = await writeDb.run(
      `
      INSERT INTO sales_returns
      (
        sale_id,
        customer_id,
        user_id,
        shift_id,
        return_date,
        reason,
        return_method,
        notes,
        total_amount,
        created_at
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      saleId,
      sale.customer_id || null,
      safeUserId,
      shiftId,
      reason || null,
      safeReturnMethod,
      notes || null,
      returnTotalAmount
    );

    const returnId = Number(returnInsert.lastID);

    for (const item of normalizedRequestItems) {
      const originalSaleItem = saleItemsMap.get(item.sale_item_id);
      const productId = Number(originalSaleItem.product_id);
      const unitPrice = Number(originalSaleItem.unit_price || 0);
      const lineTotal = Number(item.quantity) * unitPrice;

      await writeDb.run(
        `
        INSERT INTO sales_return_items
        (
          return_id,
          sale_item_id,
          product_id,
          quantity,
          unit_price,
          total_price,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
        returnId,
        item.sale_item_id,
        productId,
        item.quantity,
        unitPrice,
        lineTotal
      );

      await writeDb.run(
        `
        UPDATE products
        SET stock_quantity = stock_quantity + ?
        WHERE id = ?
        `,
        item.quantity,
        productId
      );
    }

    if (safeReturnMethod === "debt_discount" && sale.customer_id) {
      const customer = await writeDb.get(
        "SELECT id, balance FROM customers WHERE id = ?",
        sale.customer_id
      ) as any;

      const currentBalance = Number(customer?.balance || 0);
      const newBalance = currentBalance - returnTotalAmount;

      await writeDb.run(
        "UPDATE customers SET balance = ? WHERE id = ?",
        newBalance,
        sale.customer_id
      );

      const safeReturnCurrency = String(return_currency || req.body.sale_currency || "USD");
      const rate = await getRateFromUSD(safeReturnCurrency);

      await writeDb.run(
        `
        INSERT INTO customer_account_transactions
        (
          customer_id,
          transaction_type,
          reference_id,
          reference_type,
          debit_amount,
          credit_amount,
          balance_after,
          amount_original,
          currency_code,
          exchange_rate,
          note,
          created_by
        )
        VALUES (?, 'adjustment', ?, 'sales_return', 0, ?, ?, ?, ?, ?, ?, ?)
        `,
        sale.customer_id,
        returnId,
        returnTotalAmount,
        newBalance,
        returnTotalAmount * rate,
        safeReturnCurrency,
        rate,
        reason || "خصم مرتجع مبيعات من دين العميل",
        safeUserId
      );
    }

    const createdReturn = await writeDb.get(
      `
      SELECT
        sr.*,
        c.name as customer_name,
        u.full_name as user_name
      FROM sales_returns sr
      LEFT JOIN customers c ON c.id = sr.customer_id
      LEFT JOIN users u ON u.id = sr.user_id
      WHERE sr.id = ?
      `,
      returnId
    );

    const createdItems = await writeDb.all(
      `
      SELECT
        sri.*,
        p.name as product_name,
        p.barcode as product_barcode,
        p.unit as product_unit
      FROM sales_return_items sri
      LEFT JOIN products p ON p.id = sri.product_id
      WHERE sri.return_id = ?
      ORDER BY sri.id ASC
      `,
      returnId
    );

    return {
      status: 200,
      body: {
        success: true,
        message: "تم إنشاء مرتجع المبيعات بنجاح",
        return_record: createdReturn,
        items: createdItems
      }
    };
  });

  return res.status(result.status).json(result.body);
}));
app.get("/api/returns/:id", asyncHandler(async (req, res) => {
  const returnId = Number(req.params.id);

  if (!returnId || Number.isNaN(returnId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المرتجع غير صالح"
    });
  }

  const returnRecord = await readDb.get(
    `
    SELECT
      sr.*,
      s.created_at as sale_created_at,
      s.total_amount as sale_total_amount,
      s.discount as sale_discount,
      s.paid_amount as sale_paid_amount,
      s.payment_method as sale_payment_method,
      c.name as customer_name,
      c.phone as customer_phone,
      c.address as customer_address,
      u.full_name as user_name,
      su.full_name as sale_user_name,
      sh.opened_at as shift_opened_at,
      sh.closed_at as shift_closed_at,
      sh.status as shift_status,
      shu.full_name as shift_user_name
    FROM sales_returns sr
    LEFT JOIN sales s ON s.id = sr.sale_id
    LEFT JOIN customers c ON c.id = sr.customer_id
    LEFT JOIN users u ON u.id = sr.user_id
    LEFT JOIN users su ON su.id = s.user_id
    LEFT JOIN shifts sh ON sh.id = sr.shift_id
    LEFT JOIN users shu ON shu.id = sh.user_id
    WHERE sr.id = ?
    `,
    returnId
  ) as any;

  if (!returnRecord) {
    return res.status(404).json({
      success: false,
      message: "المرتجع غير موجود"
    });
  }

  const items = await readDb.all(
    `
    SELECT
      sri.*,
      p.name as product_name,
      p.barcode as product_barcode,
      p.unit as product_unit,
      si.quantity as sold_quantity,
      si.unit_price as sold_unit_price,
      si.total_price as sold_total_price
    FROM sales_return_items sri
    LEFT JOIN products p ON p.id = sri.product_id
    LEFT JOIN sale_items si ON si.id = sri.sale_item_id
    WHERE sri.return_id = ?
    ORDER BY sri.id ASC
    `,
    returnId
  ) as any[];

  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    total_price: Number(item.total_price || 0),
    sold_quantity: Number(item.sold_quantity || 0),
    sold_unit_price: Number(item.sold_unit_price || 0),
    sold_total_price: Number(item.sold_total_price || 0)
  }));

  res.json({
    success: true,
    return_record: returnRecord,
    items: normalizedItems
  });
}));

app.get("/api/returns", asyncHandler(async (req, res) => {
  const returns = await readDb.all(
    `
    SELECT
      sr.id,
      sr.sale_id,
      sr.customer_id,
      sr.user_id,
      sr.shift_id,
      sr.return_date,
      sr.reason,
      sr.return_method,
      sr.notes,
      sr.total_amount,
      sr.created_at,
      c.name as customer_name,
      u.full_name as user_name,
      s.created_at as sale_created_at,
      s.payment_method as sale_payment_method,
      sh.status as shift_status,
      shu.full_name as shift_user_name,
      (
        SELECT COUNT(*)
        FROM sales_return_items sri
        WHERE sri.return_id = sr.id
      ) as items_count
    FROM sales_returns sr
    LEFT JOIN customers c ON c.id = sr.customer_id
    LEFT JOIN users u ON u.id = sr.user_id
    LEFT JOIN sales s ON s.id = sr.sale_id
    LEFT JOIN shifts sh ON sh.id = sr.shift_id
    LEFT JOIN users shu ON shu.id = sh.user_id
    ORDER BY datetime(sr.created_at) DESC, sr.id DESC
    `
  ) as any[];

  const normalizedReturns = (Array.isArray(returns) ? returns : []).map((row) => ({
    ...row,
    total_amount: Number(row.total_amount || 0),
    items_count: Number(row.items_count || 0)
  }));

  res.json({
    success: true,
    returns: normalizedReturns
  });
}));
app.get("/api/sales/:id/returns", asyncHandler(async (req, res) => {
  const saleId = Number(req.params.id);

  if (!saleId || Number.isNaN(saleId)) {
    return res.status(400).json({
      success: false,
      message: "معرف الفاتورة غير صالح"
    });
  }

  const returns = await readDb.all(
    `
    SELECT
      sr.id,
      sr.sale_id,
      sr.customer_id,
      sr.user_id,
      sr.shift_id,
      sr.return_date,
      sr.reason,
      sr.return_method,
      sr.notes,
      sr.total_amount,
      sr.created_at,
      c.name as customer_name,
      u.full_name as user_name,
      (
        SELECT COUNT(*)
        FROM sales_return_items sri
        WHERE sri.return_id = sr.id
      ) as items_count
    FROM sales_returns sr
    LEFT JOIN customers c ON c.id = sr.customer_id
    LEFT JOIN users u ON u.id = sr.user_id
    WHERE sr.sale_id = ?
    ORDER BY datetime(sr.created_at) DESC, sr.id DESC
    `,
    saleId
  ) as any[];

  res.json({
    success: true,
    returns: (Array.isArray(returns) ? returns : []).map((row) => ({
      ...row,
      total_amount: Number(row.total_amount || 0),
      items_count: Number(row.items_count || 0)
    }))
  });
}));
  app.get("/api/sales/:id", asyncHandler(async (req, res) => {
   const sale = await readDb.get(
  `
  SELECT
    s.*,
    c.name as customer_name,
    u.full_name as user_name,
    sh.opened_at as shift_opened_at,
    sh.closed_at as shift_closed_at,
    sh.status as shift_status,
    sh.opening_balance as shift_opening_balance,
    su.full_name as shift_user_name
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN users u ON s.user_id = u.id
  LEFT JOIN shifts sh ON s.shift_id = sh.id
  LEFT JOIN users su ON sh.user_id = su.id
  WHERE s.id = ?
  `,
  req.params.id
);

    if (!sale) {
      return res.status(404).json({ message: "الفاتورة غير موجودة" });
    }

    const items = await readDb.all(
      `
      SELECT si.*, p.name as product_name
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `,
      req.params.id
    );

    res.json({ ...sale, items });
  }));

  // Purchases
  //purcahse
console.log("REGISTERED GET /api/purchases");
app.get("/api/purchases/top-products", asyncHandler(async (req, res) => {
  const topProducts = await readDb.all(`
    SELECT
      pr.id,
      pr.name,
      pr.barcode,
      pr.unit,
      pr.stock_quantity,
      pr.purchase_price,
      COUNT(DISTINCT pi.purchase_id) AS purchase_count,
      COALESCE(SUM(pi.quantity), 0) AS purchased_qty
    FROM purchase_items pi
    INNER JOIN products pr ON pr.id = pi.product_id
    GROUP BY
      pr.id,
      pr.name,
      pr.barcode,
      pr.unit,
      pr.stock_quantity,
      pr.purchase_price
    ORDER BY purchase_count DESC, purchased_qty DESC, pr.name ASC
    LIMIT 12
  `);

  res.json(topProducts);
}));
app.get("/api/purchases/latest", asyncHandler(async (req, res) => {
  const latestPurchase = await readDb.get(`
    SELECT
      p.id,
      p.total_amount,
      s.name AS supplier_name
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ORDER BY p.id DESC
    LIMIT 1
  `) as any;

  res.json({
    id: latestPurchase?.id || null,
    total_amount: Number(latestPurchase?.total_amount || 0),
    supplier_name: latestPurchase?.supplier_name || ''
  });
}));

app.get("/api/purchases", asyncHandler(async (req, res) => {
  const purchases = await readDb.all(`
    SELECT
      p.*,
      s.name as supplier_name,
      u.full_name as user_name
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
  `);
  res.json(purchases);
}));
app.get('/api/purchases/:id', asyncHandler(async (req, res) => {
  const purchaseId = Number(req.params.id);

  if (!purchaseId || Number.isNaN(purchaseId)) {
    return res.status(400).json({
      success: false,
      message: 'رقم فاتورة الشراء غير صالح'
    });
  }

  const purchase = await readDb.get(
    `
    SELECT
      p.*,
      s.name AS supplier_name,
      s.phone AS supplier_phone,
      s.address AS supplier_address,
      u.full_name AS user_name
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
    `,
    purchaseId
  );

  if (!purchase) {
    return res.status(404).json({
      success: false,
      message: 'فاتورة الشراء غير موجودة'
    });
  }

  const items = await readDb.all(
    `
    SELECT
      pi.*,
      pr.name AS product_name,
      pr.barcode AS product_barcode,
      pr.unit AS product_unit
    FROM purchase_items pi
    LEFT JOIN products pr ON pr.id = pi.product_id
    WHERE pi.purchase_id = ?
    ORDER BY pi.id ASC
    `,
    purchaseId
  );

  res.json({
    ...purchase,
    items
  });
}));
app.post("/api/purchases", asyncHandler(async (req, res) => {
  const { supplier_id, total_amount, paid_amount, user_id, items } = req.body;

  const purchaseId = await runTransaction(async () => {
    const totalAmount = Number(total_amount || 0);
    const paidAmount = Number(paid_amount || 0);
    const remaining = totalAmount - paidAmount;

    const purchaseResult = await writeDb.run(
      `
      INSERT INTO purchases (supplier_id, total_amount, paid_amount, user_id)
      VALUES (?, ?, ?, ?)
      `,
      supplier_id,
      totalAmount,
      paidAmount,
      user_id
    );

    const newPurchaseId = purchaseResult.lastID;

    for (const item of items) {
      await writeDb.run(
        `
        INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
        `,
        newPurchaseId,
        item.product_id,
        item.quantity,
        item.unit_price,
        item.total_price
      );

      await writeDb.run(
        `
        UPDATE products
        SET stock_quantity = stock_quantity + ?, purchase_price = ?
        WHERE id = ?
        `,
        item.quantity,
        item.unit_price,
        item.product_id
      );
    }

    if (supplier_id) {
      const currentSupplier = await writeDb.get(
        "SELECT balance FROM suppliers WHERE id = ?",
        supplier_id
      ) as any;

      if (!currentSupplier) {
        throw new Error("المورد غير موجود");
      }

      const oldBalance = Number(currentSupplier.balance || 0);
      const newBalance = oldBalance + remaining;

      await writeDb.run(
        "UPDATE suppliers SET balance = ? WHERE id = ?",
        newBalance,
        supplier_id
      );

      const purchaseCurrency = String(req.body.purchase_currency || req.body.sale_currency || "USD");
      const rate = await getRateFromUSD(purchaseCurrency);

      await writeDb.run(
        `
        INSERT INTO supplier_account_transactions
        (
          supplier_id,
          transaction_type,
          reference_id,
          reference_type,
          debit_amount,
          credit_amount,
          balance_after,
          amount_original,
          currency_code,
          exchange_rate,
          note,
          created_by
        )
        VALUES (?, 'purchase', ?, 'purchase', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        supplier_id,
        newPurchaseId,
        totalAmount,
        paidAmount,
        newBalance,
        totalAmount * rate,
        purchaseCurrency,
        rate,
        "ناتج عن فاتورة مشتريات",
        user_id || null
      );
    }

    return newPurchaseId;
  });

  res.json({ success: true, purchaseId });
}));




  // Expenses
  app.put("/api/expenses/:id", asyncHandler(async (req, res) => {
  const { description, amount, category, user_id } = req.body;

  await enqueueWrite(() =>
    writeDb.run(
      `UPDATE expenses
       SET description = ?, amount = ?, category = ?, user_id = ?
       WHERE id = ?`,
      [description, Number(amount), category || "عام", user_id || null, req.params.id]
    )
  );

  res.json({ success: true });
}));

app.delete("/api/expenses/:id", asyncHandler(async (req, res) => {
  await enqueueWrite(() =>
    writeDb.run(`DELETE FROM expenses WHERE id = ?`, [req.params.id])
  );

  res.json({ success: true });
}));
  app.get("/api/expenses", asyncHandler(async (req, res) => {
    res.json(await readDb.all("SELECT * FROM expenses ORDER BY created_at DESC"));
  }));

  app.post("/api/expenses", asyncHandler(async (req, res) => {
    const { description, amount, category, user_id } = req.body;
    const result = await enqueueWrite(() =>
      writeDb.run(
        "INSERT INTO expenses (description, amount, category, user_id) VALUES (?, ?, ?, ?)",
        description,
        amount,
        category,
        user_id
      )
    );
    res.json({ success: true, id: result.lastID });
  }));

  // Dashboard Stats
  app.get("/api/stats", asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const salesToday = (await readDb.get(
      "SELECT SUM(total_amount - discount) as total FROM sales WHERE DATE(created_at) = ?",
      today
    )) as any;

    const expensesToday = (await readDb.get(
      "SELECT SUM(amount) as total FROM expenses WHERE DATE(created_at) = ?",
      today
    )) as any;

    const lowStockCount = (await readDb.get(
      "SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock_level"
    )) as any;

    const productsCount = (await readDb.get(
      "SELECT COUNT(*) as count FROM products"
    )) as any;

    res.json({
      salesToday: salesToday?.total || 0,
      expensesToday: expensesToday?.total || 0,
      lowStockCount: lowStockCount?.count || 0,
      productsCount: productsCount?.count || 0
    });
  }));

  app.get("/api/dashboard/top-products", asyncHandler(async (req, res) => {
    const topProducts = await readDb.all(`
      SELECT
        p.id,
        p.name,
        p.sale_price,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        COALESCE(SUM(si.total_price), 0) as total_sales_amount
      FROM sale_items si
      INNER JOIN products p ON p.id = si.product_id
      GROUP BY p.id, p.name, p.sale_price
      ORDER BY total_sold DESC, total_sales_amount DESC
      LIMIT 10
    `);

    res.json(topProducts);
  }));

  app.get("/api/dashboard/sales-chart", asyncHandler(async (req, res) => {
    const days = Number(req.query.days || 7);

    const chart = await readDb.all(
      `
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(total_amount - discount), 0) as total,
        COUNT(*) as count
      FROM sales
      WHERE DATE(created_at) >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `,
      days
    );

    res.json(chart);
  }));

  // Reports
  app.get("/api/reports/sales", asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    const sales = await readDb.all(
      `
      SELECT DATE(created_at) as date, SUM(total_amount - discount) as total, COUNT(*) as count
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY DATE(created_at)
    `,
      start,
      end
    );
    res.json(sales);
  }));

  // Users
 app.get("/api/users", asyncHandler(async (req, res) => {
  res.json(
    await authReadDb.all(
      "SELECT id, username, full_name, role, avatar_url, is_protected_admin, created_at FROM users ORDER BY id DESC"
    )
  );
}));
app.post("/api/users", asyncHandler(async (req, res) => {
  const { username, password, full_name, role, avatar_url } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await authWriteDb.run(
    "INSERT INTO users (username, password, full_name, role, avatar_url) VALUES (?, ?, ?, ?, ?)",
    username,
    hashedPassword,
    full_name,
    role,
    avatar_url || null
  );

  await syncAuthUserToMainDb(Number(result.lastID));

res.json({ success: true, id: result.lastID });
}));
app.put("/api/users/:id", asyncHandler(async (req, res) => {
  const targetUserId = Number(req.params.id);
  const {
    username,
    full_name,
    role,
    avatar_url,
    currentUserId,
    currentUserRole
  } = req.body;

  if (!targetUserId || Number.isNaN(targetUserId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المستخدم غير صالح"
    });
  }

  if (!currentUserId || !currentUserRole) {
    return res.status(401).json({
      success: false,
      message: "بيانات المستخدم الحالي غير موجودة"
    });
  }

  const existingUser = await authReadDb.get(
    "SELECT id, username, full_name, role, avatar_url, is_protected_admin FROM users WHERE id = ?",
    targetUserId
  ) as any;

  if (!existingUser) {
    return res.status(404).json({
      success: false,
      message: "المستخدم غير موجود"
    });
  }

  const isSelfUpdate = Number(currentUserId) === targetUserId;
  const isAdmin = currentUserRole === "admin";

  if (!isAdmin && !isSelfUpdate) {
    return res.status(403).json({
      success: false,
      message: "ليس لديك صلاحية تعديل هذا المستخدم"
    });
  }

  const safeUsername = String(username ?? existingUser.username).trim();
  const safeFullName = String(full_name ?? existingUser.full_name).trim();
  const safeRole = String(role ?? existingUser.role).trim();
  const safeAvatarUrl =
    typeof avatar_url === "string" && avatar_url.trim() !== ""
      ? avatar_url.trim()
      : null;

  if (!safeUsername) {
    return res.status(400).json({
      success: false,
      message: "اسم المستخدم مطلوب"
    });
  }

  if (!safeFullName) {
    return res.status(400).json({
      success: false,
      message: "الاسم الكامل مطلوب"
    });
  }

  if (!["admin", "cashier", "warehouse"].includes(safeRole)) {
    return res.status(400).json({
      success: false,
      message: "صلاحية المستخدم غير صالحة"
    });
  }

  if (Number(existingUser.is_protected_admin || 0) === 1) {
    if (!isSelfUpdate) {
      return res.status(403).json({
        success: false,
        message: "لا يمكن تعديل الحساب الإداري المحمي إلا من داخل الحساب نفسه"
      });
    }

    if (safeRole !== "admin") {
      return res.status(400).json({
        success: false,
        message: "لا يمكن تغيير صلاحية الحساب الإداري المحمي"
      });
    }

    if (safeUsername !== existingUser.username) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن تغيير اسم مستخدم الحساب الإداري المحمي"
      });
    }
  }

  await authWriteDb.run(
    `
    UPDATE users
    SET username = ?, full_name = ?, role = ?, avatar_url = ?
    WHERE id = ?
    `,
    safeUsername,
    safeFullName,
    safeRole,
    safeAvatarUrl,
    targetUserId
  );
await syncAuthUserToMainDb(targetUserId);
  res.json({
    success: true,
    message: "تم تحديث بيانات المستخدم بنجاح"
  });
}));
  app.put("/api/users/:id/password", asyncHandler(async (req, res) => {
  const targetUserId = Number(req.params.id);
  const {
    password,
    currentPassword,
    currentUserId,
    currentUserRole
  } = req.body;

  if (!targetUserId || Number.isNaN(targetUserId)) {
    return res.status(400).json({
      success: false,
      message: "معرف المستخدم المستهدف غير صالح"
    });
  }

  if (!password || String(password).trim().length < 4) {
    return res.status(400).json({
      success: false,
      message: "كلمة المرور الجديدة غير صالحة"
    });
  }

  if (!currentUserId || !currentUserRole) {
    return res.status(401).json({
      success: false,
      message: "بيانات المستخدم الحالي غير موجودة"
    });
  }

  const targetUser = await authReadDb.get(
    "SELECT id, username, password, role, is_protected_admin FROM users WHERE id = ?",
    targetUserId
  ) as any;

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: "المستخدم غير موجود"
    });
  }

  const isSelfChange = Number(currentUserId) === targetUserId;
  const isProtectedAdmin = Number(targetUser.is_protected_admin || 0) === 1;

  // تغيير المستخدم لكلمة مروره بنفسه
  if (isSelfChange) {
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: "يجب إدخال كلمة المرور الحالية"
      });
    }

    const passwordMatch = await bcrypt.compare(String(currentPassword), String(targetUser.password || ""));
    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور الحالية غير صحيحة"
      });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

  await authWriteDb.run("UPDATE users SET password = ? WHERE id = ?", hashedPassword, targetUserId);
await syncAuthUserToMainDb(targetUserId);

    return res.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح"
    });
  }

  // تغيير كلمة مرور مستخدم آخر
  if (currentUserRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "ليس لديك صلاحية تغيير كلمة مرور مستخدم آخر"
    });
  }

  // لا تسمح لأي أحد بتغيير باسورد الأدمن المحمي
  if (isProtectedAdmin) {
    return res.status(403).json({
      success: false,
      message: "لا يمكن تغيير كلمة مرور هذا الحساب إلا من داخل الحساب نفسه وبإدخال كلمة المرور الحالية"
    });
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);

 await authWriteDb.run("UPDATE users SET password = ? WHERE id = ?", hashedPassword, targetUserId);
await syncAuthUserToMainDb(targetUserId);

  res.json({
    success: true,
    message: "تمت إعادة تعيين كلمة المرور بنجاح"
  });
}));

app.delete("/api/users/:id", asyncHandler(async (req, res) => {
  const targetUserId = Number(req.params.id);
  const { currentUserId, currentUserRole } = req.body;

  if (!currentUserId || !currentUserRole) {
    return res.status(401).json({
      success: false,
      message: "بيانات المستخدم الحالي غير موجودة"
    });
  }

  if (currentUserRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "ليس لديك صلاحية حذف المستخدمين"
    });
  }

  const targetUser = await authReadDb.get(
    "SELECT id, username, full_name FROM users WHERE id = ?",
    targetUserId
  ) as any;

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: "المستخدم غير موجود"
    });
  }

  const targetUserFull = await authReadDb.get(
    "SELECT id, username, full_name, is_protected_admin FROM users WHERE id = ?",
    targetUserId
  ) as any;

  if (Number(targetUserFull?.is_protected_admin || 0) === 1) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف الحساب الإداري المحمي"
    });
  }

  if (targetUser.username === "admin") {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف المدير الرئيسي"
    });
  }

  if (Number(currentUserId) === targetUserId) {
    return res.status(400).json({
      success: false,
      message: "لا يمكنك حذف حسابك الحالي"
    });
  }

  const salesCount = await readDb.get(
    "SELECT COUNT(*) as count FROM sales WHERE user_id = ?",
    targetUserId
  ) as any;

  const purchasesCount = await readDb.get(
    "SELECT COUNT(*) as count FROM purchases WHERE user_id = ?",
    targetUserId
  ) as any;

  const expensesCount = await readDb.get(
    "SELECT COUNT(*) as count FROM expenses WHERE user_id = ?",
    targetUserId
  ) as any;

  const shiftsCount = await readDb.get(
    "SELECT COUNT(*) as count FROM shifts WHERE user_id = ?",
    targetUserId
  ) as any;

  const customerTransactionsCount = await readDb.get(
    "SELECT COUNT(*) as count FROM customer_account_transactions WHERE created_by = ?",
    targetUserId
  ) as any;

  const supplierTransactionsCount = await readDb.get(
    "SELECT COUNT(*) as count FROM supplier_account_transactions WHERE created_by = ?",
    targetUserId
  ) as any;

  const returnsCount = await readDb.get(
    "SELECT COUNT(*) as count FROM sales_returns WHERE user_id = ?",
    targetUserId
  ) as any;

  const totalLinkedRecords =
    Number(salesCount?.count || 0) +
    Number(purchasesCount?.count || 0) +
    Number(expensesCount?.count || 0) +
    Number(shiftsCount?.count || 0) +
    Number(customerTransactionsCount?.count || 0) +
    Number(supplierTransactionsCount?.count || 0) +
    Number(returnsCount?.count || 0);

  if (totalLinkedRecords > 0) {
    return res.status(400).json({
      success: false,
      message: "لا يمكن حذف هذا المستخدم لأنه مرتبط بعمليات بيع أو شراء أو مصاريف أو ورديات أو حركات حسابات سابقة"
    });
  }

  await authWriteDb.run("DELETE FROM users WHERE id = ?", targetUserId);
  await writeDb.run("DELETE FROM users WHERE id = ?", targetUserId);

  res.json({
    success: true,
    message: "تم حذف المستخدم بنجاح"
  });
}));

  // Settings
  app.get("/api/settings", asyncHandler(async (req, res) => {
    const settings = await readDb.all("SELECT * FROM settings");
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsObj);
  }));

  app.post("/api/settings", asyncHandler(async (req, res) => {
    const settings = req.body;

    await runTransaction(async () => {
      for (const [key, value] of Object.entries(settings)) {
        await writeDb.run(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          key,
          String(value)
        );
      }
    });

    res.json({ success: true });
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const clientPath = path.join(__dirname, "..", "dist");
    console.log(`Serving static files from: ${clientPath}`);

    app.use(express.static(clientPath));

    app.get("*", (req, res) => {
      const indexPath = path.join(clientPath, "index.html");
      console.log(`Serving index.html from: ${indexPath}`);
      res.sendFile(indexPath);
    });
  }

  // central error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("API Error:", err);

    if (res.headersSent) {
      return next(err);
    }

   if (typeof err?.message === "string" && err.message.includes("UNIQUE constraint failed")) {
  if (
    err.message.includes("products.name, products.barcode") ||
    err.message.includes("idx_products_name_barcode_unique")
  ) {
    return res.status(400).json({
      success: false,
      message: "يوجد منتج مكرر بنفس الاسم ونفس الباركود"
    });
  }

  return res.status(400).json({
    success: false,
    message: "يوجد بيانات مكررة أو اسم مستخدم مستخدم مسبقًا"
  });
}

    if (typeof err?.message === "string" && err.message.includes("SQLITE_BUSY")) {
      return res.status(503).json({
        success: false,
        message: "قاعدة البيانات مشغولة حالياً، حاول مرة أخرى بعد لحظات"
      });
    }

    return res.status(500).json({
      success: false,
      message: err?.message || "حدث خطأ داخلي في السيرفر"
    });
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      resolve(server);
    });

    server.on("error", (err) => {
      console.error("Server failed to start:", err);
      reject(err);
    });
  });
}

if (process.env.NODE_ENV !== "production") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}