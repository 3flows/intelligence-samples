import { Register } from '@3flows/platform';
import { IntelligenceService, uiTool } from '@3flows/intelligence';

// UI tools: what an agent may ask a frontend to show. Each one is a tool with a typed specification;
// the handler does nothing but hand the specification back. Rendering is the frontend's job.

@Register()
export class ConsoleService extends IntelligenceService {
    handlers = () => [
        uiTool.card(),            // show_card: a summary of one thing, here an order
        uiTool.keyValueList(),    // show_key_value_list: facts, as label and value
        uiTool.callout()          // show_callout: one thing the reader must not miss
    ];
}
