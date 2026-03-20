// Offline submission queue — stores pre-starts in memory when offline
// and syncs them when connectivity is restored.
// Note: in-memory only, data persists as long as the tab is open.

type QueueItem = { id: number; data: object; queuedAt: string };
let queue: QueueItem[] = [];
let nextId = 1;

export async function enqueueSubmission(data: object): Promise<void> {
  queue.push({ id: nextId++, data, queuedAt: new Date().toISOString() });
}

export async function getQueuedSubmissions(): Promise<QueueItem[]> {
  return [...queue];
}

export async function removeFromQueue(id: number): Promise<void> {
  queue = queue.filter((item) => item.id !== id);
}

export async function getQueueCount(): Promise<number> {
  return queue.length;
}

export async function flushQueue(apiBase: string = ""): Promise<number> {
  const items = await getQueuedSubmissions();
  let flushed = 0;
  for (const item of items) {
    try {
      const res = await fetch(`${apiBase}/api/prestarts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });
      if (res.ok) {
        await removeFromQueue(item.id);
        flushed++;
      }
    } catch {
      // Still offline — stop trying
      break;
    }
  }
  return flushed;
}

export function registerServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered:", reg.scope);

        // Listen for flush requests from SW
        navigator.serviceWorker.addEventListener("message", async (event) => {
          if (event.data?.type === "FLUSH_QUEUE") {
            await flushQueue();
          }
        });
      } catch (err) {
        console.warn("SW registration failed:", err);
      }
    });
  }
}
