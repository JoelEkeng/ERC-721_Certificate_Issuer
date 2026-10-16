import { describe, it, expect } from "vitest";
import {
  CertificateStatus,
  getStatusLabel,
  certificateContract,
} from "@/lib/contracts";

describe("CertificateStatus", () => {
  it("has correct enum values matching the contract", () => {
    expect(CertificateStatus.Nonexistent).toBe(0);
    expect(CertificateStatus.Valid).toBe(1);
    expect(CertificateStatus.Revoked).toBe(2);
  });
});

describe("getStatusLabel", () => {
  it("returns Valid for status 1", () => {
    expect(getStatusLabel(1)).toBe("Valid");
  });

  it("returns Revoked for status 2", () => {
    expect(getStatusLabel(2)).toBe("Revoked");
  });

  it("returns Not Found for status 0", () => {
    expect(getStatusLabel(0)).toBe("Not Found");
  });

  it("returns Not Found for unknown status", () => {
    expect(getStatusLabel(99)).toBe("Not Found");
  });
});

describe("certificateContract", () => {
  it("has an address property", () => {
    expect(certificateContract.address).toBeDefined();
    expect(typeof certificateContract.address).toBe("string");
  });

  it("has an abi property", () => {
    expect(certificateContract.abi).toBeDefined();
    expect(Array.isArray(certificateContract.abi)).toBe(true);
  });

  it("abi includes issueCertificate function", () => {
    const issueFn = certificateContract.abi.find(
      (item: { type?: string; name?: string }) =>
        item.type === "function" && item.name === "issueCertificate"
    );
    expect(issueFn).toBeDefined();
  });

  it("abi includes verifyCertificate function", () => {
    const verifyFn = certificateContract.abi.find(
      (item: { type?: string; name?: string }) =>
        item.type === "function" && item.name === "verifyCertificate"
    );
    expect(verifyFn).toBeDefined();
  });

  it("abi includes revoke function", () => {
    const revokeFn = certificateContract.abi.find(
      (item: { type?: string; name?: string }) =>
        item.type === "function" && item.name === "revoke"
    );
    expect(revokeFn).toBeDefined();
  });

  it("abi includes CertificateIssued event", () => {
    const event = certificateContract.abi.find(
      (item: { type?: string; name?: string }) =>
        item.type === "event" && item.name === "CertificateIssued"
    );
    expect(event).toBeDefined();
  });
});
