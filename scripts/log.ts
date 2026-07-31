const start = Date.now();

function ts(): string {
  return ((Date.now() - start) / 1000).toFixed(3).padStart(9, " ");
}

export function log(msg: string): void {
  console.log(`[${ts()}] ${msg}`);
}

export function group<T>(title: string, fn: () => T): T {
  console.log(`::group::${title}`);
  const t0 = Date.now();
  log(`START ${title}`);
  try {
    const result = fn();
    log(`END ${title} ok (${((Date.now() - t0) / 1000).toFixed(3)}s)`);
    return result;
  } catch (e) {
    log(`END ${title} FAILED after ${((Date.now() - t0) / 1000).toFixed(3)}s: ${e}`);
    throw e;
  } finally {
    console.log("::endgroup::");
  }
}
