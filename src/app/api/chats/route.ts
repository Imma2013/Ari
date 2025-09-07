import db from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    let chats = await db.query.chats.findMany();
    
    // Get last assistant response for each chat
    const chatsWithResponses = await Promise.all(
      chats.map(async (chat) => {
        const lastAssistantMessage = await db.query.messages.findFirst({
          where: and(
            eq(messages.chatId, chat.id),
            eq(messages.role, 'assistant')
          ),
          orderBy: [desc(messages.createdAt)],
        });
        
        return {
          ...chat,
          lastResponse: lastAssistantMessage?.content || null
        };
      })
    );
    
    chatsWithResponses.reverse();
    return Response.json({ chats: chatsWithResponses }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
