import { describe, it, expect } from "vitest";
import { calculateRankedPoints } from "../lib/ranking";

describe("Ranked Points (Borda Count) Consensus Engine", () => {
  const options = [
    { id: "A", label: "Option A" },
    { id: "B", label: "Option B" },
    { id: "C", label: "Option C" },
  ];

  it("calculates correct point totals (3 pts for #1, 2 pts for #2, 1 pt for #3)", () => {
    // 2 voters submit: A > B > C
    // A gets 3 + 3 = 6 pts
    // B gets 2 + 2 = 4 pts
    // C gets 1 + 1 = 2 pts
    const ballots = [
      ["A", "B", "C"],
      ["A", "B", "C"],
    ];

    const result = calculateRankedPoints(options, ballots);
    expect(result.winner?.id).toBe("A");
    expect(result.winner?.totalPoints).toBe(6);
    expect(result.leaderboard[0].id).toBe("A");
    expect(result.leaderboard[1].id).toBe("B");
    expect(result.leaderboard[1].totalPoints).toBe(4);
    expect(result.leaderboard[2].id).toBe("C");
    expect(result.leaderboard[2].totalPoints).toBe(2);
    expect(result.totalBallots).toBe(2);
  });

  it("handles split ballots and calculates correct winner by highest cumulative points", () => {
    // Ballot 1: B > A > C (B: 3, A: 2, C: 1)
    // Ballot 2: B > C > A (B: 3, C: 2, A: 1)
    // Ballot 3: A > B > C (A: 3, B: 2, C: 1)
    // Totals:
    // B = 3 + 3 + 2 = 8
    // A = 2 + 1 + 3 = 6
    // C = 1 + 2 + 1 = 4
    const ballots = [
      ["B", "A", "C"],
      ["B", "C", "A"],
      ["A", "B", "C"],
    ];

    const result = calculateRankedPoints(options, ballots);
    expect(result.winner?.id).toBe("B");
    expect(result.winner?.totalPoints).toBe(8);
  });
});
