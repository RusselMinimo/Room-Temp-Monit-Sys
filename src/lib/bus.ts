import type { Reading } from "@/lib/store";

type Subscriber = (reading: Reading) => void;

const subscribers: Set<Subscriber> = new Set();

export function subscribeToReadings(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return function unsubscribe() {
    subscribers.delete(subscriber);
  };
}

export function publishReading(reading: Reading) {
  for (const subscriber of subscribers) subscriber(reading);
}


