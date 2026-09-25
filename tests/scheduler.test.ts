import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import { ratingFor, SLOW_ANSWER_MS } from "@/lib/scheduler";

describe("ratingFor", () => {
  it("rates a quick pass Good, a slow pass Hard, and a miss Again", () => {
    expect(ratingFor({ passed: true, elapsedMs: 20_000 })).toBe(Rating.Good);
    expect(ratingFor({ passed: true, elapsedMs: SLOW_ANSWER_MS + 1 })).toBe(Rating.Hard);
    expect(ratingFor({ passed: false, elapsedMs: 1_000 })).toBe(Rating.Again);
  });
});
