import { workflow } from '@3flows/intelligence';

export const quickAnswerWorkflow = workflow('starter.quickAnswer')
    .input<{ question: string }>()
    .step('answer', (s) =>
        s
            .inference()
            .chat()
            .instructions('Answer in one short paragraph. If you are unsure, say what is missing.')
            .question(({ input }) => input.question)
            .timeout('20s')
            .define()
    )
    .returns(({ steps }) => ({ answer: steps.answer.text ?? '' }));
