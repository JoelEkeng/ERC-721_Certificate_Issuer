import { describe, it, expect } from "vitest";
import { translateError } from "@/lib/errors";

describe("translateError", () => {
  it("translates user rejection", () => {
    const msg = translateError(new Error("User rejected the request."));
    expect(msg).toBe("Transaction was rejected in your wallet.");
  });

  it("translates user denied", () => {
    const msg = translateError(new Error("User denied transaction signature"));
    expect(msg).toBe("Transaction was rejected in your wallet.");
  });

  it("translates insufficient funds", () => {
    const msg = translateError(
      new Error("insufficient funds for gas * price + value")
    );
    expect(msg).toBe("Insufficient funds to cover gas costs.");
  });

  it("translates exceeds balance", () => {
    const msg = translateError(new Error("sender exceeds balance"));
    expect(msg).toBe("Insufficient funds to cover gas costs.");
  });

  it("translates OwnableUnauthorizedAccount", () => {
    const msg = translateError(
      new Error("OwnableUnauthorizedAccount(0x1234)")
    );
    expect(msg).toBe("You are not authorized to perform this action.");
  });

  it("translates EmptyRecipientName", () => {
    const msg = translateError(new Error("EmptyRecipientName()"));
    expect(msg).toBe("Recipient name cannot be empty.");
  });

  it("translates CertificateAlreadyRevoked", () => {
    const msg = translateError(new Error("CertificateAlreadyRevoked()"));
    expect(msg).toBe("Certificate is already revoked.");
  });

  it("translates NonTransferable", () => {
    const msg = translateError(new Error("NonTransferable()"));
    expect(msg).toBe("Certificates are non-transferable.");
  });

  it("translates network errors", () => {
    const msg = translateError(new Error("network timeout"));
    expect(msg).toBe("Network error. Please check your connection and try again.");
  });

  it("truncates long messages", () => {
    const long = "x".repeat(200);
    const msg = translateError(new Error(long));
    expect(msg.length).toBeLessThanOrEqual(120);
    expect(msg).toContain("...");
  });

  it("handles null/undefined", () => {
    expect(translateError(null)).toBe("An unknown error occurred.");
    expect(translateError(undefined)).toBe("An unknown error occurred.");
  });

  it("handles string errors", () => {
    const msg = translateError("something went wrong");
    expect(msg).toBe("something went wrong");
  });

  it("takes first line of multi-line errors", () => {
    const msg = translateError(new Error("First line\nSecond line\nThird"));
    expect(msg).toBe("First line");
  });
});
