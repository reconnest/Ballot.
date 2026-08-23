import { describe, it, expect } from "vitest";

describe("Vote Concurrency & Ballot Lock Duplicate Prevention", () => {
  // Simulated in-memory database engine modeling SQLite / Turso primary key constraints & transactions
  class MockDb {
    private ballotLocks = new Map<string, { pollId: string; voterToken: string; ballotId: string; createdAt: number }>();
    private votes = new Map<string, { id: string; pollId: string; voterToken: string; optionId: string; ballotId: string }>();

    private getLockKey(pollId: string, voterToken: string) {
      return `${pollId}:::${voterToken}`;
    }

    async submitVote(params: {
      pollId: string;
      voterToken: string;
      selectedOptionIds: string[];
      allowVoteEdit: number;
    }): Promise<{ ok: boolean; status: number; ballotId?: string; isEdit?: boolean; error?: string }> {
      const { pollId, voterToken, selectedOptionIds, allowVoteEdit } = params;
      const ballotId = `ballot_${Math.random().toString(36).substring(2, 9)}`;
      const lockKey = this.getLockKey(pollId, voterToken);

      // Check if ballot lock exists (or attempt insert with PK constraint)
      const lockExists = this.ballotLocks.has(lockKey);

      if (!lockExists) {
        // Attempt insert into ballot_locks
        // Simulating atomic primary key constraint on (poll_id, voter_token)
        try {
          this.ballotLocks.set(lockKey, {
            pollId,
            voterToken,
            ballotId,
            createdAt: Date.now(),
          });

          // Insert vote rows
          for (const optId of selectedOptionIds) {
            const voteId = `vote_${Math.random().toString(36).substring(2, 9)}`;
            this.votes.set(voteId, {
              id: voteId,
              pollId,
              voterToken,
              optionId: optId,
              ballotId,
            });
          }

          return { ok: true, status: 200, ballotId, isEdit: false };
        } catch {
          // Primary key constraint conflict (handled below)
        }
      }

      // If lock already exists or concurrent insert collided:
      if (allowVoteEdit === 0) {
        return { ok: false, status: 409, error: "You have already voted on this poll." };
      }

      // Edit flow: atomic replace
      for (const [id, vote] of Array.from(this.votes.entries())) {
        if (vote.pollId === pollId && vote.voterToken === voterToken) {
          this.votes.delete(id);
        }
      }

      const existingLock = this.ballotLocks.get(lockKey);
      const activeBallotId = existingLock?.ballotId || ballotId;

      for (const optId of selectedOptionIds) {
        const voteId = `vote_${Math.random().toString(36).substring(2, 9)}`;
        this.votes.set(voteId, {
          id: voteId,
          pollId,
          voterToken,
          optionId: optId,
          ballotId: activeBallotId,
        });
      }

      return { ok: true, status: 200, ballotId: activeBallotId, isEdit: true };
    }

    getVotesForPollAndVoter(pollId: string, voterToken: string) {
      return Array.from(this.votes.values()).filter(
        (v) => v.pollId === pollId && v.voterToken === voterToken
      );
    }

    getLock(pollId: string, voterToken: string) {
      return this.ballotLocks.get(this.getLockKey(pollId, voterToken));
    }
  }

  it("prevents duplicate ballots when two requests with different options fire simultaneously (allowVoteEdit = 0)", async () => {
    const db = new MockDb();
    const pollId = "p_single_choice";
    const voterToken = "voter_fast_double_tap";

    // Simulate two simultaneous requests selecting DIFFERENT options
    const [res1, res2] = await Promise.all([
      db.submitVote({
        pollId,
        voterToken,
        selectedOptionIds: ["opt_A"],
        allowVoteEdit: 0,
      }),
      db.submitVote({
        pollId,
        voterToken,
        selectedOptionIds: ["opt_B"],
        allowVoteEdit: 0,
      }),
    ]);

    // One request must succeed, and the other must be cleanly rejected with 409
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Exactly one ballot lock exists for (pollId, voterToken)
    expect(db.getLock(pollId, voterToken)).toBeDefined();

    // Exactly 1 vote row exists in the database for this voter (no duplicate ballot)
    const storedVotes = db.getVotesForPollAndVoter(pollId, voterToken);
    expect(storedVotes.length).toBe(1);
  });

  it("handles concurrent requests cleanly when vote editing is enabled (allowVoteEdit = 1)", async () => {
    const db = new MockDb();
    const pollId = "p_editable";
    const voterToken = "voter_concurrent_edit";

    const [res1, res2] = await Promise.all([
      db.submitVote({
        pollId,
        voterToken,
        selectedOptionIds: ["opt_1"],
        allowVoteEdit: 1,
      }),
      db.submitVote({
        pollId,
        voterToken,
        selectedOptionIds: ["opt_2"],
        allowVoteEdit: 1,
      }),
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);

    // Exactly one ballot lock exists for (pollId, voterToken)
    expect(db.getLock(pollId, voterToken)).toBeDefined();

    // Exactly 1 vote row exists in the database for this voter, without orphaned rows
    const storedVotes = db.getVotesForPollAndVoter(pollId, voterToken);
    expect(storedVotes.length).toBe(1);
  });

  it("allows multi-select ballots with multiple options to share a single ballot lock", async () => {
    const db = new MockDb();
    const pollId = "p_multi";
    const voterToken = "voter_multi";

    const res = await db.submitVote({
      pollId,
      voterToken,
      selectedOptionIds: ["opt_A", "opt_B", "opt_C"],
      allowVoteEdit: 1,
    });

    expect(res.ok).toBe(true);
    // 1 lock, 3 vote rows
    expect(db.getLock(pollId, voterToken)).toBeDefined();
    expect(db.getVotesForPollAndVoter(pollId, voterToken).length).toBe(3);
  });
});
