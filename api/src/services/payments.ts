import type { Pool, PoolClient } from "pg";

export async function recalcTicketPaymentStatus(
  client: Pick<PoolClient, "query">,
  ticketId: number
): Promise<void> {
  const t = await client.query<{
    id: number;
    fee: string | null;
  }>(`SELECT id, fee::text AS fee FROM tickets WHERE id = $1`, [ticketId]);
  const ticket = t.rows[0];
  if (!ticket) return;

  const paidR = await client.query<{ sum: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS sum FROM payments WHERE ticket_id = $1`,
    [ticketId]
  );
  const totalPaid = parseFloat(paidR.rows[0]?.sum ?? "0");
  const fee = ticket.fee != null ? parseFloat(ticket.fee) : 0;

  let paymentStatus: string;
  if (fee === 0) {
    paymentStatus = "UNPAID";
  } else if (totalPaid >= fee) {
    paymentStatus = "PAID";
  } else if (totalPaid > 0) {
    paymentStatus = "PARTIALLY_PAID";
  } else {
    paymentStatus = "UNPAID";
  }

  await client.query(`UPDATE tickets SET payment_status = $1 WHERE id = $2`, [
    paymentStatus,
    ticketId
  ]);
}
