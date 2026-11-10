import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  boolean,
  date,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  stylePreferences: jsonb('style_preferences'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clothes = pgTable('clothes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),

  category: text('category').notNull(),
  color: text('color').notNull(),
  style: text('style').notNull(),

  brand: text('brand'),
  price: integer('price'),
  purchasedAt: date('purchased_at'),

  modelVersion: text('model_version'),
  aiConfidence: real('ai_confidence'),
  aiPredicted: jsonb('ai_predicted'),
  userCorrected: boolean('user_corrected').default(false).notNull(),
  gptAnalysis: jsonb('gpt_analysis'),

  wearCount: integer('wear_count').default(0).notNull(),
  lastWornAt: timestamp('last_worn_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const outfits = pgTable('outfits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  wornDate: date('worn_date').notNull(),
  weather: jsonb('weather'),
  occasion: text('occasion'),
  rating: integer('rating'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const outfitItems = pgTable(
  'outfit_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outfitId: uuid('outfit_id')
      .notNull()
      .references(() => outfits.id, { onDelete: 'cascade' }),
    clothesId: uuid('clothes_id')
      .notNull()
      .references(() => clothes.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    uniq: uniqueIndex('outfit_clothes_unique').on(t.outfitId, t.clothesId),
  })
);

export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  contextSnapshot: jsonb('context_snapshot'),
  recommendedOutfits: jsonb('recommended_outfits').notNull(),
  gptReasoning: text('gpt_reasoning'),
  modelUsed: text('model_used'),
  modelConfidence: real('model_confidence'),
  fallbackTriggered: boolean('fallback_triggered').default(false).notNull(),
  accepted: boolean('accepted').default(false).notNull(),
  acceptedOutfitId: uuid('accepted_outfit_id').references(() => outfits.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Clothes = typeof clothes.$inferSelect;
export type NewClothes = typeof clothes.$inferInsert;
export type Outfit = typeof outfits.$inferSelect;
export type NewOutfit = typeof outfits.$inferInsert;
export type OutfitItem = typeof outfitItems.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
