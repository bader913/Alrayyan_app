import { pool, withTransaction } from '../../shared/db/pool.js';
import { recordStockMovement } from '../../shared/services/stockMovements.service.js';
import { generateInvoiceNumber } from '../../shared/utils/invoiceNumber.js';

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface SaleItemInput {
  product_id:    number;
  quantity:      number;      // كغ للموزون، وحدات للعادي
  unit_price:    number;      // السعر الفعلي المُطبَّق (بعد اختيار النوع/override)
  price_type:    'retail' | 'wholesale' | 'custom';
  item_discount: number;      // خصم على هذا البند
}

export interface CreateSaleInput {
  shift_id:        number;
  pos_terminal_id: number | null;
  customer_id:     number | null;
  sale_type:       'retail' | 'wholesale';
  items:           SaleItemInput[];
  sale_discount:   number;           // خصم على مستوى الفاتورة
  payment_method:  'cash' | 'card' | 'credit' | 'mixed';
  paid_amount:     number;           // المبلغ المدفوع (0 للدين الكامل)
  notes?:          string;
}

// ─── Pricing Helper (server-side validation/reference) ────────────────────────
// الـ pricing الفعلي يُحسب client-side، لكن نتحقق منه هنا

export function resolvePrice(product: {
  retail_price: string;
  wholesale_price: string | null;
  wholesale_min_qty: string;
}, qty: number, saleType: 'retail' | 'wholesale', customerType?: string): {
  price: number;
  type: 'retail' | 'wholesale';
} {
  const isWholesaleContext = saleType === 'wholesale' || customerType === 'wholesale';
  const wPrice = product.wholesale_price ? parseFloat(product.wholesale_price) : null;
  const wMinQty = parseFloat(product.wholesale_min_qty);

  if (isWholesaleContext && wPrice && qty >= wMinQty) {
    return { price: wPrice, type: 'wholesale' };
  }

  return { price: parseFloat(product.retail_price), type: 'retail' };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SalesService {
  // ─── Create Sale (Core POS Transaction) ───────────────────────────────────
  async createSale(input: CreateSaleInput, userId: number) {
    if (input.items.length === 0) {
      throw Object.assign(new Error('السلة فارغة'), { statusCode: 400 });
    }

    let result: {
      saleId: number;
      invoiceNumber: string;
      subtotal: number;
      total_amount: number;
      paid_amount: number;
      due_amount: number;
    };

    await withTransaction(async (client) => {
      // 1. تحقق من الوردية
      const shiftRow = await client.query<{ status: string; pos_terminal_id: string }>(
        'SELECT status, pos_terminal_id FROM shifts WHERE id = $1 FOR UPDATE',
        [input.shift_id]
      );

      if (!shiftRow.rows[0]) {
        throw Object.assign(new Error('الوردية غير موجودة'), { statusCode: 404 });
      }
      if (shiftRow.rows[0].status !== 'open') {
        throw Object.assign(new Error('الوردية مغلقة — لا يمكن إتمام البيع'), { statusCode: 409 });
      }

      // 2. احضار نوع العميل (لتحديد الـ pricing)
      let customerType: string | undefined;
      if (input.customer_id) {
        const cust = await client.query<{ customer_type: string; balance: string }>(
          'SELECT customer_type, balance FROM customers WHERE id = $1',
          [input.customer_id]
        );
        customerType = cust.rows[0]?.customer_type;
      }

      // 3. تحقق من صحة كل بند ولا قفل المنتجات
      const processedItems: Array<SaleItemInput & {
        total_price: number;
        product_name: string;
      }> = [];

      for (const item of input.items) {
        if (item.quantity <= 0) {
          throw Object.assign(new Error('الكمية يجب أن تكون أكبر من صفر'), { statusCode: 400 });
        }

        const prodRow = await client.query<{
          id: string; name: string; stock_quantity: string; is_active: boolean;
          retail_price: string; wholesale_price: string | null; wholesale_min_qty: string;
        }>(
          `SELECT id, name, stock_quantity, is_active,
                  retail_price, wholesale_price, wholesale_min_qty
           FROM products WHERE id = $1 FOR UPDATE`,
          [item.product_id]
        );

        if (!prodRow.rows[0]) {
          throw Object.assign(new Error(`المنتج رقم ${item.product_id} غير موجود`), { statusCode: 404 });
        }

        const p = prodRow.rows[0];

        if (!p.is_active) {
          throw Object.assign(new Error(`المنتج "${p.name}" غير نشط`), { statusCode: 400 });
        }

        const stock = parseFloat(p.stock_quantity);
        if (stock < item.quantity) {
          throw Object.assign(
            new Error(`مخزون "${p.name}" غير كافٍ. المتوفر: ${stock.toFixed(3)}, المطلوب: ${item.quantity}`),
            { statusCode: 400 }
          );
        }

        const total_price = item.quantity * item.unit_price - item.item_discount;
        processedItems.push({ ...item, total_price, product_name: p.name });
      }

      // 4. حساب الإجماليات
      const subtotal = processedItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const items_discount_total = processedItems.reduce((s, i) => s + i.item_discount, 0);
      const total_amount = subtotal - items_discount_total - input.sale_discount;

      if (total_amount < 0) {
        throw Object.assign(new Error('إجمالي الفاتورة لا يمكن أن يكون سالباً'), { statusCode: 400 });
      }

      const paid_amount = input.payment_method === 'credit' ? 0 : input.paid_amount;
      const due_amount  = total_amount - paid_amount;

      if (input.payment_method === 'credit' && !input.customer_id) {
        throw Object.assign(new Error('البيع بالآجل يتطلب تحديد عميل'), { statusCode: 400 });
      }

      // 5. رقم الفاتورة
      const invoiceNumber = await generateInvoiceNumber(client, 'INV');

      // 6. إنشاء السجل الرئيسي
      const saleInsert = await client.query<{ id: string }>(
        `INSERT INTO sales
           (invoice_number, customer_id, user_id, shift_id, pos_terminal_id,
            sale_type, subtotal, discount, total_amount, paid_amount, payment_method, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          invoiceNumber,
          input.customer_id,
          userId,
          input.shift_id,
          input.pos_terminal_id,
          input.sale_type,
          subtotal,
          items_discount_total + input.sale_discount,
          total_amount,
          paid_amount,
          input.payment_method,
          input.notes ?? null,
        ]
      );

      const saleId = parseInt(saleInsert.rows[0].id, 10);

      // 7. بنود البيع + حركات المخزون
      for (const item of processedItems) {
        await client.query(
          `INSERT INTO sale_items
             (sale_id, product_id, quantity, unit_price, discount, total_price, price_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [saleId, item.product_id, item.quantity, item.unit_price,
           item.item_discount, item.total_price, item.price_type]
        );

        await recordStockMovement(client, {
          product_id:     item.product_id,
          movement_type:  'sale',
          quantity_change: -item.quantity,
          reference_id:   saleId,
          reference_type: 'sale',
          note:           `فاتورة ${invoiceNumber}`,
          created_by:     userId,
        });
      }

      // 8. حساب العميل (إذا كان هناك مبلغ مؤجل)
      if (input.customer_id && due_amount > 0) {
        const custUpdate = await client.query<{ balance: string }>(
          'UPDATE customers SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance',
          [due_amount, input.customer_id]
        );

        await client.query(
          `INSERT INTO customer_account_transactions
             (customer_id, transaction_type, reference_id, reference_type,
              debit_amount, balance_after, note, created_by)
           VALUES ($1, 'sale', $2, 'sale', $3, $4, $5, $6)`,
          [
            input.customer_id, saleId, due_amount,
            custUpdate.rows[0].balance,
            `بيع فاتورة ${invoiceNumber}`,
            userId,
          ]
        );
      }

      result = { saleId, invoiceNumber, subtotal, total_amount, paid_amount, due_amount };
    });

    // بعد commit — جلب الفاتورة الكاملة
    return this.getSaleById(result!.saleId);
  }

  // ─── Get Sale with Items ───────────────────────────────────────────────────
  async getSaleById(id: number) {
    const saleResult = await pool.query(
      `SELECT s.*,
              c.name AS customer_name,
              c.phone AS customer_phone,
              c.customer_type,
              u.full_name AS cashier_name,
              t.name AS terminal_name,
              t.code AS terminal_code
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN pos_terminals t ON t.id = s.pos_terminal_id
       WHERE s.id = $1`,
      [id]
    );

    if (!saleResult.rows[0]) return null;

    const itemsResult = await pool.query(
      `SELECT si.*, p.name AS product_name, p.unit, p.is_weighted
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1
       ORDER BY si.id ASC`,
      [id]
    );

    return { ...saleResult.rows[0], items: itemsResult.rows };
  }

  // ─── List Sales ────────────────────────────────────────────────────────────
  async listSales(filters: {
    shift_id?: number;
    customer_id?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters.shift_id) {
      conditions.push(`s.shift_id = $${idx++}`);
      values.push(filters.shift_id);
    }
    if (filters.customer_id) {
      conditions.push(`s.customer_id = $${idx++}`);
      values.push(filters.customer_id);
    }
    if (filters.date_from) {
      conditions.push(`s.created_at >= $${idx++}`);
      values.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push(`s.created_at < $${idx++}`);
      values.push(filters.date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = ((filters.page ?? 1) - 1) * limit;

    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::bigint FROM sales s ${where}`, values
    );
    const total = parseInt(count.rows[0].count, 10);

    const sales = await pool.query(
      `SELECT s.id, s.invoice_number, s.total_amount, s.paid_amount, s.payment_method,
              s.sale_type, s.created_at,
              c.name AS customer_name, u.full_name AS cashier_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    return {
      sales: sales.rows,
      pagination: { total, page: filters.page ?? 1, limit, pages: Math.ceil(total / limit) },
    };
  }
}
