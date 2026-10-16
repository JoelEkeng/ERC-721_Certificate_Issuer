/**
 * Zod schemas for form validation.
 * Mirrors the contract's validation rules.
 */
import { z } from "zod";
import { isAddress } from "viem";

export const MAX_NAME_LENGTH = 128;
export const MAX_COURSE_TITLE_LENGTH = 256;

export const issueCertificateSchema = z.object({
  recipient: z
    .string()
    .min(1, "Recipient address is required.")
    .refine(
      (val): val is `0x${string}` => isAddress(val),
      "Invalid Ethereum address."
    ),
  recipientName: z
    .string()
    .min(1, "Recipient name is required.")
    .refine((val) => val.trim().length > 0, "Name cannot be whitespace only.")
    .refine(
      (val) => new TextEncoder().encode(val).length <= MAX_NAME_LENGTH,
      `Name exceeds ${MAX_NAME_LENGTH} bytes.`
    ),
  courseTitle: z
    .string()
    .min(1, "Course title is required.")
    .refine(
      (val) => val.trim().length > 0,
      "Course title cannot be whitespace only."
    )
    .refine(
      (val) =>
        new TextEncoder().encode(val).length <= MAX_COURSE_TITLE_LENGTH,
      `Course title exceeds ${MAX_COURSE_TITLE_LENGTH} bytes.`
    ),
});

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;

/** Form-level input type (before Zod refinement narrows `recipient`). */
export type IssueCertificateFormValues = z.input<typeof issueCertificateSchema>;

export const revokeSchema = z.object({
  tokenId: z
    .string()
    .min(1, "Token ID is required.")
    .refine(
      (val) => /^\d+$/.test(val) && Number(val) >= 0,
      "Token ID must be a non-negative integer."
    ),
});

export type RevokeInput = z.infer<typeof revokeSchema>;

export const verifySchema = z.object({
  tokenId: z
    .string()
    .min(1, "Token ID is required.")
    .refine(
      (val) => /^\d+$/.test(val) && Number(val) >= 0,
      "Token ID must be a non-negative integer."
    ),
});

export type VerifyInput = z.infer<typeof verifySchema>;
