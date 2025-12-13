import { z } from "zod";

export const marketTypeSchema = z.enum(["spot", "futures"]);

export const priceQuerySchema = z.object({
  symbol: z.string().min(1, "symbol is required"),
  type: marketTypeSchema.default("spot"),
});

export const candlesQuerySchema = z.object({
  symbol: z.string().min(1, "symbol is required"),
  type: marketTypeSchema.default("spot"),
  interval: z.string().default("1m"),
  limit: z.coerce.number().min(1).max(500).default(120),
});

export const alarmCreateSchema = z.object({
  symbol: z.string().min(1, "symbol is required").transform((s) => s.toUpperCase()),
  marketType: marketTypeSchema,
  direction: z.enum(["above", "below", "cross"]),
  targetPrice: z.coerce.number().positive(),
  repeat: z.boolean().optional().default(false),
  note: z.string().max(140).optional().or(z.literal("")),
});

export const alarmUpdateSchema = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  repeat: z.boolean().optional(),
});

export type AlarmCreateInput = z.infer<typeof alarmCreateSchema>;
export type AlarmUpdateInput = z.infer<typeof alarmUpdateSchema>;
