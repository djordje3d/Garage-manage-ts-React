import crypto from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTicketToken(garageId: number): string {
  let randomPart = "";
  for (let i = 0; i < 6; i += 1) {
    randomPart += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return `G${garageId}${randomPart}`;
}
