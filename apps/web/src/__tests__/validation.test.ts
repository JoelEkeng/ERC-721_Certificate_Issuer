import { describe, it, expect } from "vitest";
import {
  issueCertificateSchema,
  revokeSchema,
  verifySchema,
  MAX_NAME_LENGTH,
  MAX_COURSE_TITLE_LENGTH,
} from "@/lib/validation";

describe("issueCertificateSchema", () => {
  it("accepts valid input", () => {
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: "Alice Johnson",
      courseTitle: "Solidity 101",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty recipient", () => {
    const result = issueCertificateSchema.safeParse({
      recipient: "",
      recipientName: "Alice",
      courseTitle: "Course",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid Ethereum address", () => {
    const result = issueCertificateSchema.safeParse({
      recipient: "not-an-address",
      recipientName: "Alice",
      courseTitle: "Course",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid Ethereum address.");
    }
  });

  it("rejects address without 0x prefix", () => {
    const result = issueCertificateSchema.safeParse({
      recipient: "d8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: "Alice",
      courseTitle: "Course",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: "",
      courseTitle: "Course",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: "   ",
      courseTitle: "Course",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Name cannot be whitespace only."
      );
    }
  });

  it("rejects empty course title", () => {
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: "Alice",
      courseTitle: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only course title", () => {
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: "Alice",
      courseTitle: "\t\n ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding max byte length", () => {
    const longName = "a".repeat(MAX_NAME_LENGTH + 1);
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: longName,
      courseTitle: "Course",
    });
    expect(result.success).toBe(false);
  });

  it("accepts name at exactly max byte length", () => {
    const maxName = "a".repeat(MAX_NAME_LENGTH);
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: maxName,
      courseTitle: "Course",
    });
    expect(result.success).toBe(true);
  });

  it("rejects course title exceeding max byte length", () => {
    const longTitle = "b".repeat(MAX_COURSE_TITLE_LENGTH + 1);
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: "Alice",
      courseTitle: longTitle,
    });
    expect(result.success).toBe(false);
  });

  it("counts multi-byte Unicode characters correctly", () => {
    // Each emoji is 4 bytes in UTF-8, so 33 emojis = 132 bytes > 128
    const emojiName = "\u{1F600}".repeat(33);
    const result = issueCertificateSchema.safeParse({
      recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      recipientName: emojiName,
      courseTitle: "Course",
    });
    expect(result.success).toBe(false);
  });
});

describe("revokeSchema", () => {
  it("accepts valid token ID", () => {
    const result = revokeSchema.safeParse({ tokenId: "0" });
    expect(result.success).toBe(true);
  });

  it("accepts large token ID", () => {
    const result = revokeSchema.safeParse({ tokenId: "999999" });
    expect(result.success).toBe(true);
  });

  it("rejects empty token ID", () => {
    const result = revokeSchema.safeParse({ tokenId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative number", () => {
    const result = revokeSchema.safeParse({ tokenId: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric string", () => {
    const result = revokeSchema.safeParse({ tokenId: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects decimal", () => {
    const result = revokeSchema.safeParse({ tokenId: "1.5" });
    expect(result.success).toBe(false);
  });
});

describe("verifySchema", () => {
  it("accepts valid token ID", () => {
    const result = verifySchema.safeParse({ tokenId: "42" });
    expect(result.success).toBe(true);
  });

  it("rejects empty input", () => {
    const result = verifySchema.safeParse({ tokenId: "" });
    expect(result.success).toBe(false);
  });
});
