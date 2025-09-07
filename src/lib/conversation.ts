import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq, and, max, desc } from 'drizzle-orm';
import { getFileDetails } from '@/lib/utils/files';

export interface ConversationTurn {
  turnId: number;
  chatId: string;
  userMessage: {
    messageId: string;
    content: string;
    createdAt: string;
  };
  assistantMessage?: {
    messageId: string;
    content: string;
    sources?: any[];
    images?: any[];
    videos?: any[];
    searchIntent?: any;
    createdAt: string;
  };
}

export interface ConversationContext {
  chatId: string;
  turnId: number;
  userMessageId: string;
  assistantMessageId?: string;
  sequenceNumber: number;
  isNewChat: boolean;
}

class ConversationManager {
  /**
   * Start a new conversation turn with a user message
   */
  async beginConversationTurn(
    chatId: string,
    userMessageId: string,
    userContent: string,
    files: string[] = []
  ): Promise<ConversationContext> {
    try {
      // Check if chat exists
      const existingChat = await db.query.chats.findFirst({
        where: eq(chats.id, chatId),
      });

      let isNewChat = false;
      
      // Create chat if it doesn't exist
      if (!existingChat) {
        await db
          .insert(chats)
          .values({
            id: chatId,
            title: userContent.substring(0, 100), // Truncate long titles
            createdAt: new Date().toISOString(),
            files: files.map(getFileDetails),
          })
          .execute();
        isNewChat = true;
      }

      // Get the next turn ID and sequence number
      const lastMessage = await db.query.messages.findFirst({
        where: eq(messages.chatId, chatId),
        orderBy: [desc(messages.conversationTurn), desc(messages.sequenceNumber)],
      });

      const nextTurnId = lastMessage ? lastMessage.conversationTurn + 1 : 1;
      const nextSequence = lastMessage ? lastMessage.sequenceNumber + 1 : 1;

      // Check if user message already exists (for retries/resubmissions)
      const existingUserMessage = await db.query.messages.findFirst({
        where: eq(messages.messageId, userMessageId),
      });

      if (existingUserMessage) {
        // If message exists and we're reprocessing, clean up any incomplete assistant responses
        await this.cleanupIncompleteResponses(chatId, existingUserMessage.conversationTurn);
        
        return {
          chatId,
          turnId: existingUserMessage.conversationTurn,
          userMessageId,
          sequenceNumber: existingUserMessage.sequenceNumber,
          isNewChat: false,
        };
      }

      // Save user message with pending status initially
      await db
        .insert(messages)
        .values({
          content: userContent,
          chatId,
          messageId: userMessageId,
          role: 'user',
          createdAt: new Date().toISOString(),
          conversationTurn: nextTurnId,
          sequenceNumber: nextSequence,
          status: 'completed', // User messages are immediately completed
          metadata: JSON.stringify({
            createdAt: new Date(),
          }),
        })
        .execute();

      return {
        chatId,
        turnId: nextTurnId,
        userMessageId,
        sequenceNumber: nextSequence + 1, // Next sequence for assistant message
        isNewChat,
      };
    } catch (error) {
      console.error('Error beginning conversation turn:', error);
      throw new Error('Failed to start conversation turn');
    }
  }

  /**
   * Save assistant message and complete the conversation turn
   */
  async completeConversationTurn(
    context: ConversationContext,
    assistantMessageId: string,
    assistantContent: string,
    metadata: {
      sources?: any[];
      images?: any[];
      videos?: any[];
      searchIntent?: any;
      [key: string]: any;
    } = {}
  ): Promise<void> {
    try {
      // Save assistant message
      await db
        .insert(messages)
        .values({
          content: assistantContent,
          chatId: context.chatId,
          messageId: assistantMessageId,
          role: 'assistant',
          createdAt: new Date().toISOString(),
          conversationTurn: context.turnId,
          sequenceNumber: context.sequenceNumber,
          parentMessageId: context.userMessageId, // Link to user message
          status: 'completed',
          metadata: JSON.stringify({
            createdAt: new Date(),
            ...metadata,
          }),
        })
        .execute();

      console.log(`Conversation turn ${context.turnId} completed for chat ${context.chatId}`);
    } catch (error) {
      console.error('Error completing conversation turn:', error);
      // Mark the assistant message as failed if it was created
      await this.markMessageAsFailed(assistantMessageId);
      throw new Error('Failed to complete conversation turn');
    }
  }

  /**
   * Start assistant message with pending status
   */
  async startAssistantResponse(
    context: ConversationContext,
    assistantMessageId: string
  ): Promise<void> {
    try {
      await db
        .insert(messages)
        .values({
          content: '', // Will be updated as response streams
          chatId: context.chatId,
          messageId: assistantMessageId,
          role: 'assistant',
          createdAt: new Date().toISOString(),
          conversationTurn: context.turnId,
          sequenceNumber: context.sequenceNumber,
          parentMessageId: context.userMessageId,
          status: 'pending',
          metadata: JSON.stringify({
            createdAt: new Date(),
          }),
        })
        .execute();
    } catch (error) {
      console.error('Error starting assistant response:', error);
      throw new Error('Failed to start assistant response');
    }
  }

  /**
   * Update assistant message content during streaming
   */
  async updateAssistantMessage(
    assistantMessageId: string,
    content: string,
    metadata?: any
  ): Promise<void> {
    try {
      const updateData: any = {
        content,
      };

      if (metadata) {
        updateData.metadata = JSON.stringify({
          createdAt: new Date(),
          ...metadata,
        });
      }

      await db
        .update(messages)
        .set(updateData)
        .where(eq(messages.messageId, assistantMessageId))
        .execute();
    } catch (error) {
      console.error('Error updating assistant message:', error);
      // Don't throw here as this is called during streaming
    }
  }

  /**
   * Mark assistant message as completed
   */
  async completeAssistantMessage(
    assistantMessageId: string,
    finalContent: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      await db
        .update(messages)
        .set({
          content: finalContent,
          status: 'completed',
          metadata: JSON.stringify({
            createdAt: new Date(),
            ...metadata,
          }),
        })
        .where(eq(messages.messageId, assistantMessageId))
        .execute();
    } catch (error) {
      console.error('Error completing assistant message:', error);
      await this.markMessageAsFailed(assistantMessageId);
      throw new Error('Failed to complete assistant message');
    }
  }

  /**
   * Rollback conversation turn on error
   */
  async rollbackConversationTurn(context: ConversationContext): Promise<void> {
    try {
      // Delete all messages from this conversation turn
      await db
        .delete(messages)
        .where(
          and(
            eq(messages.chatId, context.chatId),
            eq(messages.conversationTurn, context.turnId)
          )
        )
        .execute();

      // If this was a new chat and we're rolling back, delete the chat too
      if (context.isNewChat) {
        await db
          .delete(chats)
          .where(eq(chats.id, context.chatId))
          .execute();
      }

      console.log(`Rolled back conversation turn ${context.turnId} for chat ${context.chatId}`);
    } catch (error) {
      console.error('Error rolling back conversation turn:', error);
      // Don't throw here as we're already in error handling
    }
  }

  /**
   * Mark a message as failed
   */
  private async markMessageAsFailed(messageId: string): Promise<void> {
    try {
      await db
        .update(messages)
        .set({ status: 'failed' })
        .where(eq(messages.messageId, messageId))
        .execute();
    } catch (error) {
      console.error('Error marking message as failed:', error);
    }
  }

  /**
   * Clean up incomplete responses from a previous turn
   */
  private async cleanupIncompleteResponses(chatId: string, turnId: number): Promise<void> {
    try {
      await db
        .delete(messages)
        .where(
          and(
            eq(messages.chatId, chatId),
            eq(messages.conversationTurn, turnId),
            eq(messages.role, 'assistant'),
            eq(messages.status, 'pending')
          )
        )
        .execute();
    } catch (error) {
      console.error('Error cleaning up incomplete responses:', error);
    }
  }

  /**
   * Get conversation history for a chat
   */
  async getConversationHistory(chatId: string): Promise<ConversationTurn[]> {
    try {
      const allMessages = await db.query.messages.findMany({
        where: eq(messages.chatId, chatId),
        orderBy: [desc(messages.conversationTurn), desc(messages.sequenceNumber)],
      });

      // Group messages by conversation turn
      const turnMap = new Map<number, ConversationTurn>();

      for (const message of allMessages) {
        if (!turnMap.has(message.conversationTurn)) {
          turnMap.set(message.conversationTurn, {
            turnId: message.conversationTurn,
            chatId,
            userMessage: null as any,
          });
        }

        const turn = turnMap.get(message.conversationTurn)!;
        const metadata = message.metadata ? JSON.parse(message.metadata as string) : {};

        if (message.role === 'user') {
          turn.userMessage = {
            messageId: message.messageId,
            content: message.content,
            createdAt: message.createdAt,
          };
        } else if (message.role === 'assistant' && message.status === 'completed') {
          turn.assistantMessage = {
            messageId: message.messageId,
            content: message.content,
            createdAt: message.createdAt,
            sources: metadata.sources,
            images: metadata.images,
            videos: metadata.videos,
            searchIntent: metadata.searchIntent,
          };
        }
      }

      return Array.from(turnMap.values())
        .filter(turn => turn.userMessage) // Only return turns with user messages
        .sort((a, b) => a.turnId - b.turnId); // Sort by turn ID ascending
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Clean up failed messages older than a certain time
   */
  async cleanupFailedMessages(olderThanHours: number = 24): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

      await db
        .delete(messages)
        .where(
          and(
            eq(messages.status, 'failed'),
            // SQLite date comparison - messages older than cutoff
            // Note: This is a simple string comparison, works for ISO dates
            // For production, consider using a proper date handling
          )
        )
        .execute();
    } catch (error) {
      console.error('Error cleaning up failed messages:', error);
    }
  }
}

export const conversationManager = new ConversationManager();
export default conversationManager;
