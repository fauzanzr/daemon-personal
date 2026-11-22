import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const chats = pgTable('chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  modelId: text('model_id').notNull().default('gemini-3.8-flash'),
  systemPrompt: text('system_prompt'),
  isPinned: boolean('is_pinned').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chatId: uuid('chat_id')
      .references(() => chats.id, { onDelete: 'cascade' })
      .notNull(),
    parentMessageId: uuid('parent_message_id'),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    modelUsed: text('model_used'),
    revisionType: text('revision_type').default('initial').notNull(), // 'initial' | 'critique' | 'side_by_side'
    attachments: jsonb('attachments').$type<
      {
        type: 'document' | 'image';
        name: string;
        tokenEstimate?: number;
      }[]
    >(),
    alternatives: jsonb('alternatives').$type<
      {
        modelId: string;
        content: string;
      }[]
    >(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('messages_chat_id_idx').on(table.chatId)],
);

export const presets = pgTable('presets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  defaultModel: text('default_model').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
