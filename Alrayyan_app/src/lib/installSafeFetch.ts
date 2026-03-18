let safeFetchInstalled = false;

export function installSafeFetch() {
  if (safeFetchInstalled) return;
  safeFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const activeRequests = new Map<number, { url: string; start: number }>();
  let requestId = 0;

  const DEFAULT_TIMEOUT = 10000;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const id = ++requestId;
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

    const method = (init?.method || 'GET').toUpperCase();
    const controller = new AbortController();
    const timeoutMs = DEFAULT_TIMEOUT;

    const externalSignal = init?.signal;
    const startedAt = Date.now();

    activeRequests.set(id, { url: `${method} ${url}`, start: startedAt });

    const timeoutId = window.setTimeout(() => {
      controller.abort(new DOMException(`Request timeout after ${timeoutMs}ms`, 'AbortError'));
    }, timeoutMs);

    const onAbort = () => {
      controller.abort(new DOMException('External abort', 'AbortError'));
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        onAbort();
      } else {
        externalSignal.addEventListener('abort', onAbort, { once: true });
      }
    }

    try {
      console.log(`[FETCH START #${id}] ${method} ${url}`);

      const response = await originalFetch(input, {
        ...init,
        signal: controller.signal,
        cache: 'no-store'
      });

      const duration = Date.now() - startedAt;
      console.log(`[FETCH END   #${id}] ${method} ${url} -> ${response.status} (${duration}ms)`);

      return response;
    } catch (error: any) {
      const duration = Date.now() - startedAt;
      console.error(
        `[FETCH FAIL  #${id}] ${method} ${url} after ${duration}ms`,
        error?.name || error,
        error
      );
      throw error;
    } finally {
      clearTimeout(timeoutId);
      activeRequests.delete(id);

      if (externalSignal) {
        externalSignal.removeEventListener('abort', onAbort);
      }
    }
  };

  // مراقبة دورية للطلبات المعلقة
  window.setInterval(() => {
    const now = Date.now();
    const slowRequests = [...activeRequests.entries()]
      .map(([id, info]) => ({
        id,
        url: info.url,
        age: now - info.start
      }))
      .filter((r) => r.age > 3000);

    if (slowRequests.length > 0) {
      console.warn('[SLOW REQUESTS]', slowRequests);
    }
  }, 2000);

  console.log('Safe fetch installed');
}