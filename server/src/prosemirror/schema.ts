import { getSchema } from "@tiptap/core";
import { serverExtensions } from "./extensions.js";

export const schema = getSchema(serverExtensions);
