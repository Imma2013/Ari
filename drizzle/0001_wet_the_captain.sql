ALTER TABLE `messages` ADD `conversationTurn` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `sequenceNumber` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `parentMessageId` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `status` text DEFAULT 'completed';--> statement-breakpoint
CREATE INDEX `conversation_turn_idx` ON `messages` (`chatId`,`conversationTurn`);--> statement-breakpoint
CREATE INDEX `sequence_idx` ON `messages` (`chatId`,`sequenceNumber`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `messages` (`status`);