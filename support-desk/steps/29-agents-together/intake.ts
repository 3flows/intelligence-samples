import { workflow } from '@3flows/intelligence';
import { statusAfterTriage } from './rules.js';
import type { StoredTicket } from './services.js';
import { triage } from './triage.js';

// What happens to a new ticket, step by step. The steps are ours and always run in this order:
// the model answers questions inside a step, it doesn't decide which step comes next.

type Intake = { ticketId: string };

export const intake = workflow('support.intake')
    .input<Intake>()

    .step('ticket', (s) => s
        .map(async ({ input, context }) => {
            const ticket = await context.doc().collection('tickets').by(input.ticketId).get<StoredTicket>();
            if (!ticket) throw new Error(`Ticket ${input.ticketId} not found`);
            return ticket;
        })
        .define())

    // The model decides what the ticket means. A provider hiccup gets a second attempt.
    .step('triage', (s) => s
        .map(({ steps, context }) => triage(context, steps.ticket))
        .retry({ attempts: 2 })
        .timeout('60s')
        .define())

    // Our rule decides where it goes, and the ticket is stored with both.
    .step('route', (s) => s
        .map(async ({ steps, context }) => {
            const status = statusAfterTriage(steps.triage);
            await context.doc().collection('tickets').by(steps.ticket.id).set({ ...steps.ticket, triage: steps.triage, status });
            return status;
        })
        .define())

    // Only where a person has to take over: the case researcher prepares the brief.
    .when('needsPerson', ({ steps }) => steps.route !== 'open')
    .step('brief', (s) => s
        .service('SupportService')
        .method('prepareCase')
        .input(({ input }: { input: Intake }) => ({ ticketId: input.ticketId }))
        .define())
    .end()

    .returns(({ steps }) => ({ status: steps.route }));
