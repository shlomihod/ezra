import { getDocument, getThreadsForDoc } from "../db.js";

export function ezraThreads(docId: string, status?: "open" | "resolved" | "all") {
  const doc = getDocument(docId);
  if (!doc) throw new Error(`Document not found: ${docId}`);

  let threads = getThreadsForDoc(docId);

  if (status && status !== "all") {
    threads = threads.filter((t) => t.status === status);
  }

  return threads;
}
