import type { PoolClient } from "pg";
import * as paymentsRepo from "../repositories/paymentsRepository";

export async function recalcTicketPaymentStatus(
  client: Pick<PoolClient, "query">,
  ticketId: number
): Promise<void> {
  const amounts = await paymentsRepo.getTicketFeeAndPaid(client, ticketId);
  if (!amounts) return;

  const { fee, totalPaid } = amounts;
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

  await paymentsRepo.updateTicketPaymentStatus(client, ticketId, paymentStatus);
}
