import type pg from 'pg';

export const generateInvoiceNumber = async (
  client: pg.PoolClient,
  prefix: string
): Promise<string> => {
  const result = await client.query<{ last_number: number }>(
    `UPDATE invoice_sequences
     SET last_number = last_number + 1
     WHERE prefix = $1
     RETURNING last_number`,
    [prefix]
  );

  if (!result.rows[0]) {
    throw new Error(`Invoice sequence for prefix "${prefix}" not found`);
  }

  const num = result.rows[0].last_number;
  const year = new Date().getFullYear();
  const padded = String(num).padStart(6, '0');

  return `${prefix}-${year}-${padded}`;
};
