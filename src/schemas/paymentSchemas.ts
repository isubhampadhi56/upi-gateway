import { z } from "zod";

export const createPaymentLinkSchema = z.object({
  intentURL: z
    .string()
    .min(1, "intentURL is required")
    .refine((val) => val.startsWith("upi://"), {
      message: "intentURL must start with upi://",
    }),
  allowedIP: z
    .string()
    .min(1, "allowedIP is required"),
  orderId: z.string().optional(),
  timeout: z.number().positive("timeout must be a positive number").optional(),
  upiApps: z.string().optional(),
  callbackUrl: z
    .object({
      successCallbackUrl: z.string().url("successCallbackUrl must be a valid URL").optional(),
      failureCallbackUrl: z.string().url("failureCallbackUrl must be a valid URL").optional(),
      pendingCallbackUrl: z.string().url("pendingCallbackUrl must be a valid URL").optional(),
    })
    .optional(),
});

export const updatePaymentSchema = z.object({
  id: z.string().min(1, "id is required"),
  status: z.enum(["pending", "success", "failure"]),
  errorMessage: z.string().optional(),
});

export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
