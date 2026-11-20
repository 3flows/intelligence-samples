import { AIMessage, History, IntelligenceServiceContext } from '@3flows/intelligence';

// The chat of a ticket is our own record, stored next to the ticket. The model remembers nothing:
// on every turn we send it the part of this record that it should see.

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

type Docs = Pick<IntelligenceServiceContext, 'doc'>;

/** Everything said on a ticket so far. */
export const chatOf = async (context: Docs, ticketId: string): Promise<ChatTurn[]> =>
    (await context.doc().collection('chats').by(ticketId).get<{ messages: ChatTurn[] }>())?.messages ?? [];

/** Store one turn: what the customer wrote, and what the assistant answered. */
export async function remember(context: Docs, ticketId: string, message: string, answer: string): Promise<void> {
    const messages: ChatTurn[] = [
        ...(await chatOf(context, ticketId)),
        { role: 'user', content: message },
        { role: 'assistant', content: answer }
    ];
    await context.doc().collection('chats').by(ticketId).set({ ticketId, messages });
}

/** What the model gets of it: the last messages, not the whole chat. */
export const recent = (messages: ChatTurn[]): AIMessage[] => History.window(messages, { maxMessages: 20 });
