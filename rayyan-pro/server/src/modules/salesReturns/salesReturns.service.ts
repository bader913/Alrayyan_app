import { pool, withTransaction } from '../../shared/db/pool.js';
import { recordStockMovement } from '../../shared/services/stockMovements.service.js';
import { generateInvoiceNumber } from '../../shared/utils/invoiceNumber.js';

export interface ReturnItemInput {
  sale_item_id: number | null;
  product_id:   number;
  quantity:     number;
  unit_price:   number;
}

export interface CreateReturnInput {
  sale_id:       number;
  items:         ReturnItemInput[];
  return_method: 'cash_refund' | 'debt_discount' | 'stock_only';
  reason?:       string;
  notes?:        string;
  shift_id?:     number | null;
}

export class SalesReturnsService {

  async createReturn(input: CreateReturnInput, userId: number) {
    if (input.items.length === 0) {
      throw Object.assign(new Error('لا توجد بنود للإرجاع'), { statusCode: 400 });
    }

    let result: {
      returnId:     number;
      returnNumber: string;
      totalAmount:  number;
    };

    await withTransaction(async (client) => {
      // 1. تحقق من فاتورة البيع
      const saleRow = await client.query<{
        id: number; customer_id: string; total_amount: string;
      }>(
        'SELECT id, customer_id, total_amount FROM sales WHERE id = $1 FOR UPDATE',
        [input.sale_id]
      );
      if (!saleRow.rows[0]) {
        throw Object.assign(new Error('فاتورة البيع غير موجودة'), { statusCode: 404 });
      }

      // 2. توليد رقم المرتجع
      const returnNumber = await generateInvoiceNumber(client, 'RET');

      // 3. احتساب المجموع
      let totalAmount = 0;
      for (const item of input.items) {
        totalAmount += item.quantity * item.unit_price;
      }

      // 4. إنشاء رأس المرتجع
      const returnRow = await client.query<{ id: number }>(
        `INSERT INTO sales_returns
           (return_number, sale_id, customer_id, user_id, shift_id,
            return_method, total_amount, reason, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          returnNumber,
          input.sale_id,
          saleRow.rows[0].customer_id ?? null,
          userId,
          input.shift_id ?? null,
          input.return_method,
          totalAmount,
          input.reason ?? null,
          input.notes  ?? null,
        ]
      );
      const returnId = returnRow.rows[0].id;

      // 5. إدراج البنود + إعادة المخزون
      for (const item of input.items) {
        const lineTotal = item.quantity * item.unit_price;

        await client.query(
          `INSERT INTO sales_return_items
             (return_id, sale_item_id, product_id, quantity, unit_price, total_price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [returnId, item.sale_item_id, item.product_id, item.quantity, item.unit_price, lineTotal]
        );

        // إعادة الكمية للمخزون
        await recordStockMovement(client, {
          product_id:      item.product_id,
          movement_type:   'return_in',
          quantity_change: item.quantity,
          reference_id:    returnId,
          reference_type:  'sale_return',
          note:            `مرتجع ${returnNumber}`,
          created_by:      userId,
        });
      }

      // 6. معالجة طريقة الإرجاع
      const customerId = saleRow.rows[0].customer_id;

      if (customerId) {
        if (input.return_method === 'debt_discount') {
          // تخفيض الدين على العميل
          await client.query(
            `UPDATE customers SET balance = GREATEST(0, balance - $1), updated_at = NOW() WHERE id = $2`,
            [totalAmount, customerId]
          );
          const custRow = await client.query<{ balance: string }>(
            'SELECT balance FROM customers WHERE id = $1',
            [customerId]
          );
          const balanceAfter = parseFloat(custRow.rows[0]?.balance ?? '0');
          await client.query(
            `INSERT INTO customer_account_transactions
               (customer_id, transaction_type, reference_id, reference_type,
                debit_amount, credit_amount, balance_after, currency_code,
                exchange_rate, note, created_by)
             VALUES ($1,'return',$2,'sale_return',0,$3,$4,'USD',1,$5,$6)`,
            [customerId, returnId, totalAmount, balanceAfter,
             `مرتجع ${returnNumber} — خصم من الدين`, userId]
          );
        } else if (input.return_method === 'cash_refund') {
          // رد نقدي — لا نغير رصيد العميل لكن نسجل الحركة
          const custRow = await client.query<{ balance: string }>(
            'SELECT balance FROM customers WHERE id = $1',
            [customerId]
          );
          const balanceAfter = parseFloat(custRow.rows[0]?.balance ?? '0');
          await client.query(
            `INSERT INTO customer_account_transactions
               (customer_id, transaction_type, reference_id, reference_type,
                debit_amount, credit_amount, balance_after, currency_code,
                exchange_rate, note, created_by)
             VALUES ($1,'return',$2,'sale_return',0,0,$3,'USD',1,$4,$5)`,
            [customerId, returnId, balanceAfter,
             `مرتجع ${returnNumber} — رد نقدي`, userId]
          );
        }
        // stock_only: لا تغيير مالي
      }

      result = { returnId, returnNumber, totalAmount };
    });

    return result!;
  }

  async listReturns(params: {
    sale_id?:    number;
    date_from?:  string;
    date_to?:    string;
    page?:       number;
    limit?:      number;
  }) {
    const page   = params.page  ?? 1;
    const limit  = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[]    = [];
    let idx = 1;

    if (params.sale_id) {
      conditions.push(`r.sale_id = $${idx++}`);
      values.push(params.sale_id);
    }
    if (params.date_from) {
      conditions.push(`r.created_at >= $${idx++}`);
      values.push(params.date_from);
    }
    if (params.date_to) {
      conditions.push(`r.created_at < ($${idx++}::date + interval '1 day')`);
      values.push(params.date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM sales_returns r ${where}`,
      values
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const rows = await pool.query(
      `SELECT r.id, r.return_number, r.sale_id, r.return_method,
              r.total_amount, r.reason, r.notes, r.created_at,
              r.customer_id,
              s.invoice_number AS sale_invoice,
              c.name AS customer_name,
              u.full_name AS created_by
       FROM sales_returns r
       LEFT JOIN sales s ON s.id = r.sale_id
       LEFT JOIN customers c ON c.id = r.customer_id
       LEFT JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return { returns: rows.rows, total, page, limit };
  }

  async getReturnById(id: number) {
    const returnRow = await pool.query(
      `SELECT r.id, r.return_number, r.sale_id, r.return_method,
              r.total_amount, r.reason, r.notes, r.created_at,
              s.invoice_number AS sale_invoice,
              c.name AS customer_name,
              u.full_name AS created_by
       FROM sales_returns r
       LEFT JOIN sales s ON s.id = r.sale_id
       LEFT JOIN customers c ON c.id = r.customer_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.id = $1`,
      [id]
    );
    if (!returnRow.rows[0]) return null;

    const itemsRow = await pool.query(
      `SELECT ri.id, ri.product_id, ri.quantity, ri.unit_price, ri.total_price,
              p.name AS product_name, p.barcode, p.unit
       FROM sales_return_items ri
       JOIN products p ON p.id = ri.product_id
       WHERE ri.return_id = $1
       ORDER BY ri.id`,
      [id]
    );

    return { ...returnRow.rows[0], items: itemsRow.rows };
  }

  async getSaleForReturn(saleId: number) {
    const saleRow = await pool.query(
      `SELECT s.id, s.invoice_number, s.total_amount, s.paid_amount,
              s.sale_type, s.created_at,
              c.name AS customer_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.id = $1`,
      [saleId]
    );
    if (!saleRow.rows[0]) return null;

    const itemsRow = await pool.query(
      `SELECT si.id, si.product_id, si.quantity, si.unit_price, si.total_price,
              si.price_type, p.name AS product_name, p.barcode, p.unit
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = $1
       ORDER BY si.id`,
      [saleId]
    );

    return { ...saleRow.rows[0], items: itemsRow.rows };
  }
}
