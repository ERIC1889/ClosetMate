import { z } from 'zod';

export const recommendationItemSchema = z.object({
  clothes_ids: z.array(z.string().uuid()).min(1),
  reason: z.string().min(1),
  score: z.number().min(0).max(1),
});

export const recommendationResponseSchema = z.object({
  outfits: z.array(recommendationItemSchema).min(1).max(3),
  model_confidence: z.number().min(0).max(1),
});

export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;

export const recommendationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['outfits', 'model_confidence'],
  properties: {
    outfits: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clothes_ids', 'reason', 'score'],
        properties: {
          clothes_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
          reason: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    model_confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;
