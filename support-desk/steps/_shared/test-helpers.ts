/** POST JSON to a platform HTTP endpoint and return the parsed JSON response. */
export async function post<T = any>(url: string, body: unknown = {}): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`POST ${url} failed with ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as T;
}

/** Retry `probe` until it returns something truthy, e.g. until a background job has finished. */
export async function eventually<T>(probe: () => Promise<T | undefined | null | false>, timeoutMs = 5000): Promise<T> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const value = await probe();
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out after ${timeoutMs}ms`);
}

export const API = 'http://127.0.0.1:3000';
