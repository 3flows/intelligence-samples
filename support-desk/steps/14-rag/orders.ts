import { Register, Service, handler, t } from '@3flows/platform';

export const Order = t.object({
    number: t.string(),
    email: t.string(),
    status: t.enum(['processing', 'shipped', 'delivered']),
    items: t.array(t.string()),
    shippedAt: t.string().nullable()
});
export type Order = t.infer<typeof Order>;

/** A few orders, so the sample has something to look up. */
export const SAMPLE_ORDERS: Order[] = [
    { number: 'A-1042', email: 'ada@example.com', status: 'shipped', items: ['brake pads B01', 'bell'], shippedAt: '2025-05-02' },
    { number: 'A-1043', email: 'grace@example.com', status: 'processing', items: ['Velo City 3, 54 cm'], shippedAt: null },
    { number: 'A-1044', email: 'ada@example.com', status: 'delivered', items: ['helmet, M'], shippedAt: '2025-04-11' }
];

/** Stands in for the shop's order system. */
@Register()
export class OrdersService extends Service {
    handlers = () => [
        handler(
            'lookupOrder',
            t.object({ number: t.string().describe('Order number like A-1042'), email: t.string() }),
            Order.nullable(),
            async ({ number, email }, trigger) => {
                const order = await trigger.context.doc().collection('orders').by(number).get<Order>();
                // Only the customer who placed the order gets to see it.
                await trigger.ok(order && order.email === email ? order : null);
            },
            'Look up an order by its number: status, items and shipping date. Returns null if there is no such order for this customer.'
        ),

        handler('seedOrders', t.object({}).optional(), t.object({ orders: t.number() }), async (_input, trigger) => {
            for (const order of SAMPLE_ORDERS) await trigger.context.doc().collection('orders').by(order.number).set(order);
            await trigger.ok({ orders: SAMPLE_ORDERS.length });
        })
    ];
}
