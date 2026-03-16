import { getOperationsSince } from "../db.js";

export function ezraChangesSince(cursor: number) {
  const ops = getOperationsSince(cursor);
  return {
    operations: ops,
    next_cursor: ops.length > 0 ? ops[ops.length - 1].id : cursor,
  };
}
