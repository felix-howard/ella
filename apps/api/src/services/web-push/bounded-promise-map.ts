export async function boundedPromiseMap<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex])
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))
  return results
}
