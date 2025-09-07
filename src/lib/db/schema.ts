import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  chatId: text('chatId').notNull(),
  messageId: text('messageId').notNull(),
  role: text('type').$type<'assistant' | 'user'>(),
  metadata: text('metadata', {
    mode: 'json',
  }),
  createdAt: text('createdAt').notNull(),
  // New fields for better conversation management
  conversationTurn: integer('conversationTurn').notNull().default(0),
  sequenceNumber: integer('sequenceNumber').notNull().default(0),
  parentMessageId: text('parentMessageId'), // For threading support
  status: text('status').$type<'pending' | 'completed' | 'failed'>().default('completed'),
}, (table) => ({
  // Add indexes for better query performance
  chatIdIdx: index('chat_id_idx').on(table.chatId),
  messageIdIdx: index('message_id_idx').on(table.messageId),
  roleIdx: index('role_idx').on(table.role),
  // Composite index for common queries
  chatRoleIdx: index('chat_role_idx').on(table.chatId, table.role),
  // Add index for sorting by creation date
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  // New indexes for conversation management
  conversationTurnIdx: index('conversation_turn_idx').on(table.chatId, table.conversationTurn),
  sequenceIdx: index('sequence_idx').on(table.chatId, table.sequenceNumber),
  statusIdx: index('status_idx').on(table.status),
}));

interface File {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  files: text('files', { mode: 'json' })
    .$type<File[]>()
    .default(sql`'[]'`),
}, (table) => ({
  // Add index for sorting by creation date
  createdAtIdx: index('chats_created_at_idx').on(table.createdAt),
}));
