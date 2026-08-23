import { describe, it, expect } from "vitest";
import { calculateIRV } from "../lib/irv";

describe("Instant Runoff Voting (IRV) Algorithm", () => {
  const options = [
    { id: "A", label: "Option A" },
    { id: "B", label: "Option B" },
    { id: "C", label: "Option C" },
  ];

  it("identifies a majority winner in Round 1 (> 50% of first-preference votes)", () => {
    // 4 voters for A, 2 voters for B, 1 voter for C
    const ballots = [
      ["A", "B", "C"],
      ["A", "C", "B"],
      ["A", "B", "C"],
      ["A", "C", "B"],
      ["B", "A", "C"],
      ["B", "C", "A"],
      ["C", "B", "A"],
    ];

    const result = calculateIRV(options, ballots);
    expect(result.winner).not.toBeNull();
    expect(result.winner?.id).toBe("A");
    expect(result.winningRound).toBe(1);
    expect(result.totalBallots).toBe(7);
  });

  it("correctly eliminates lowest option and transfers votes to 2nd choice across rounds", () => {
    // 10 total ballots:
    // 4 voters: B > A > C
    // 3 voters: C > A > B
    // 3 voters: A > B > C
    // Round 1: B=4, C=3, A=3. Neither has >50% (need 6 votes).
    // Lowest is eliminated and transferred.
    const ballots = [
      ["B", "A", "C"],
      ["B", "A", "C"],
      ["B", "A", "C"],
      ["B", "A", "C"],
      ["C", "A", "B"],
      ["C", "A", "B"],
      ["C", "A", "B"],
      ["A", "B", "C"],
      ["A", "B", "C"],
      ["A", "B", "C"],
    ];

    const result = calculateIRV(options, ballots);
    expect(result.rounds.length).toBeGreaterThanOrEqual(2);
    expect(result.winner).not.toBeNull();
  });

  it("handles empty or single-option ballots gracefully", () => {
    const emptyResult = calculateIRV(options, []);
    expect(emptyResult.winner).toBeNull();
    expect(emptyResult.totalBallots).toBe(0);

    const singleBallot = calculateIRV(options, [["A"]]);
    expect(singleBallot.winner?.id).toBe("A");
    expect(singleBallot.winningRound).toBe(1);
  });
});
