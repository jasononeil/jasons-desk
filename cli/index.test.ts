import { describe, test, expect } from "bun:test";
import { main } from "./index.ts";

describe("desk-cli entrypoint", () => {
  test("defines the root command", () => {
    expect(main).toBeDefined();
  });
});
