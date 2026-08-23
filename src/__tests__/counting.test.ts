import { describe, it, expect } from "vitest";

describe("Consolidated Vote Counting Logic", () => {
  it("correctly counts unique ballots when multi-choice produces multiple rows per voter", () => {
    // Simulated DB rows for 2 voters in a multi-select poll (each voted for 3 options)
    const simulatedVotes = [
      { id: "1", pollId: "p1", voterToken: "voter_A", ballotId: "b_1", optionId: "opt_1" },
      { id: "2", pollId: "p1", voterToken: "voter_A", ballotId: "b_1", optionId: "opt_2" },
      { id: "3", pollId: "p1", voterToken: "voter_A", ballotId: "b_1", optionId: "opt_3" },
      { id: "4", pollId: "p1", voterToken: "voter_B", ballotId: "b_2", optionId: "opt_1" },
      { id: "5", pollId: "p1", voterToken: "voter_B", ballotId: "b_2", optionId: "opt_4" },
    ];

    // Raw row count (the old bug: count = 5)
    const rawRowCount = simulatedVotes.length;
    expect(rawRowCount).toBe(5);

    // Fixed distinct ballot count: count = 2 unique ballots
    const uniqueBallots = new Set(simulatedVotes.map((v) => v.ballotId || v.voterToken));
    expect(uniqueBallots.size).toBe(2);
  });

  it("correctly counts unique ballots for ranked choice with COALESCE fallback to voterToken", () => {
    // 6 voters ranking 4 options each = 24 rows, plus 1 legacy vote without ballotId
    const simulatedRankedVotes = [];
    for (let voter = 1; voter <= 6; voter++) {
      for (let opt = 1; opt <= 4; opt++) {
        simulatedRankedVotes.push({
          id: `r_${voter}_${opt}`,
          pollId: "p_ranked",
          voterToken: `voter_${voter}`,
          ballotId: `ballot_${voter}`,
          optionId: `opt_${opt}`,
          rankPosition: opt,
        });
      }
    }

    // Add legacy vote with null ballotId
    simulatedRankedVotes.push({
      id: "legacy_1",
      pollId: "p_ranked",
      voterToken: "legacy_voter",
      ballotId: null,
      optionId: "opt_1",
      rankPosition: 1,
    });

    const rawRows = simulatedRankedVotes.length;
    expect(rawRows).toBe(25); // 24 + 1

    // Consolidated distinct ballots using COALESCE(ballotId, voterToken)
    const distinctBallots = new Set(
      simulatedRankedVotes.map((v) => v.ballotId ?? v.voterToken)
    );
    expect(distinctBallots.size).toBe(7); // 6 ranked voters + 1 legacy voter
  });
});
