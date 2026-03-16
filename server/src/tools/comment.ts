import { nanoid } from "nanoid";
import { getDocOrThrow, createThread, createReply, logOperation } from "../db.js";
import { resolveSpan } from "../prosemirror/helpers.js";
import type { DocJson } from "../prosemirror/helpers.js";
import { broadcast } from "../ws.js";

export function ezraComment(docId: string, anchorText: string, body: string, author = "Claude", anchorEnd?: string) {
  const doc = getDocOrThrow(docId);
  const content: DocJson = JSON.parse(doc.content);
  const span = resolveSpan(content, anchorText, anchorEnd);
  if (!span) throw new Error(`Text not found in document.`);

  const threadId = nanoid(10);
  const replyId = nanoid(10);

  createThread(threadId, docId, span.text);
  createReply(replyId, threadId, author, body);
  logOperation("comment", docId, JSON.stringify({ thread_id: threadId, anchor_text: span.text }));

  broadcast("threads_update", { doc_id: docId }, docId);

  return { thread_id: threadId, doc_id: docId };
}
