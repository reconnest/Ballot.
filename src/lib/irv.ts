export type IRVTally = {
  optionId: string;
  label: string;
  votes: number;
  pct: number;
};

export type IRVRound = {
  roundNumber: number;
  tallies: IRVTally[];
  eliminatedOptionId?: string;
  eliminatedLabel?: string;
  transferredVotes?: number;
  totalActiveBallots: number;
};

export type IRVConsensusItem = {
  id: string;
  label: string;
  rank: number;
  status: string;
  finalVotes: number;
  finalPct: number;
};

export type IRVResult = {
  winner: { id: string; label: string; votes: number; pct: number } | null;
  winningRound: number;
  rounds: IRVRound[];
  totalBallots: number;
  consensusOrder: IRVConsensusItem[];
  isTie?: boolean;
};

/**
 * Calculates Instant Runoff Voting (IRV) rounds and consensus winner.
 * @param options List of poll options
 * @param ballots Array of ordered option ID arrays (from 1st preference to last preference)
 */
export function calculateIRV(
  options: { id: string; label: string; imageUrl?: string | null }[],
  ballots: string[][]
): IRVResult {
  const labelMap = new Map<string, string>();
  for (const opt of options) {
    labelMap.set(opt.id, opt.label);
  }

  const totalBallots = ballots.length;
  if (totalBallots === 0 || options.length === 0) {
    return {
      winner: null,
      winningRound: 0,
      rounds: [],
      totalBallots: 0,
      consensusOrder: options.map((o, i) => ({
        id: o.id,
        label: o.label,
        rank: i + 1,
        status: "No votes yet",
        finalVotes: 0,
        finalPct: 0,
      })),
    };
  }

  // Filter valid ballots (containing known options)
  const cleanBallots = ballots
    .map((b) => b.filter((id) => labelMap.has(id)))
    .filter((b) => b.length > 0);

  if (cleanBallots.length === 0) {
    return {
      winner: null,
      winningRound: 0,
      rounds: [],
      totalBallots: 0,
      consensusOrder: options.map((o, i) => ({
        id: o.id,
        label: o.label,
        rank: i + 1,
        status: "No votes yet",
        finalVotes: 0,
        finalPct: 0,
      })),
    };
  }

  const activeCandidates = new Set<string>(options.map((o) => o.id));
  const eliminationOrder: { id: string; round: number; votes: number; pct: number }[] = [];
  const rounds: IRVRound[] = [];
  let roundNumber = 1;
  let winner: { id: string; label: string; votes: number; pct: number } | null = null;
  let winningRound = 1;

  while (activeCandidates.size > 0) {
    // 1. Count 1st active choice for each ballot
    const counts = new Map<string, number>();
    for (const c of activeCandidates) {
      counts.set(c, 0);
    }

    let activeBallotsCount = 0;
    for (const ballot of cleanBallots) {
      const firstActive = ballot.find((id) => activeCandidates.has(id));
      if (firstActive) {
        counts.set(firstActive, (counts.get(firstActive) || 0) + 1);
        activeBallotsCount++;
      }
    }

    if (activeBallotsCount === 0) {
      break;
    }

    // Build tallies sorted descending
    const tallies: IRVTally[] = Array.from(activeCandidates).map((id) => {
      const votes = counts.get(id) || 0;
      const pct = activeBallotsCount > 0 ? Math.round((votes / activeBallotsCount) * 100) : 0;
      return {
        optionId: id,
        label: labelMap.get(id) || "Option",
        votes,
        pct,
      };
    });

    tallies.sort((a, b) => b.votes - a.votes);

    const topCandidate = tallies[0];
    const threshold = activeBallotsCount / 2;

    // Check for majority winner (> 50%) or if only 1 active candidate remains
    if (topCandidate.votes > threshold || activeCandidates.size === 1) {
      winner = {
        id: topCandidate.optionId,
        label: topCandidate.label,
        votes: topCandidate.votes,
        pct: topCandidate.pct,
      };
      winningRound = roundNumber;

      rounds.push({
        roundNumber,
        tallies,
        totalActiveBallots: activeBallotsCount,
      });
      break;
    }

    // Check for tie among all remaining active candidates
    const lowestVotes = tallies[tallies.length - 1].votes;
    if (topCandidate.votes === lowestVotes) {
      // Complete tie
      winner = {
        id: topCandidate.optionId,
        label: topCandidate.label,
        votes: topCandidate.votes,
        pct: topCandidate.pct,
      };
      winningRound = roundNumber;
      rounds.push({
        roundNumber,
        tallies,
        totalActiveBallots: activeBallotsCount,
      });
      break;
    }

    // Find candidate to eliminate (the one with the lowest votes)
    const toEliminate = tallies[tallies.length - 1];
    activeCandidates.delete(toEliminate.optionId);

    eliminationOrder.push({
      id: toEliminate.optionId,
      round: roundNumber,
      votes: toEliminate.votes,
      pct: toEliminate.pct,
    });

    rounds.push({
      roundNumber,
      tallies,
      eliminatedOptionId: toEliminate.optionId,
      eliminatedLabel: toEliminate.label,
      transferredVotes: toEliminate.votes,
      totalActiveBallots: activeBallotsCount,
    });

    roundNumber++;
  }

  // Construct consensus ranking:
  // 1st: Winner
  // Remaining: from last eliminated to first eliminated
  const rankedItems: IRVConsensusItem[] = [];
  const addedIds = new Set<string>();

  if (winner) {
    rankedItems.push({
      id: winner.id,
      label: winner.label,
      rank: 1,
      status: winningRound === 1 ? "1st Round Majority Winner" : `Won in Round ${winningRound} (${winner.pct}% Majority)`,
      finalVotes: winner.votes,
      finalPct: winner.pct,
    });
    addedIds.add(winner.id);
  }

  // Add eliminated candidates in reverse (last eliminated = runner up)
  const reversedEliminations = [...eliminationOrder].reverse();
  for (let i = 0; i < reversedEliminations.length; i++) {
    const item = reversedEliminations[i];
    if (!addedIds.has(item.id)) {
      rankedItems.push({
        id: item.id,
        label: labelMap.get(item.id) || "Option",
        rank: rankedItems.length + 1,
        status: i === 0 ? `Runner-Up (Eliminated in Round ${item.round})` : `Eliminated in Round ${item.round}`,
        finalVotes: item.votes,
        finalPct: item.pct,
      });
      addedIds.add(item.id);
    }
  }

  // Any options not yet included
  for (const opt of options) {
    if (!addedIds.has(opt.id)) {
      rankedItems.push({
        id: opt.id,
        label: opt.label,
        rank: rankedItems.length + 1,
        status: "0 1st-Choice Votes",
        finalVotes: 0,
        finalPct: 0,
      });
    }
  }

  return {
    winner,
    winningRound,
    rounds,
    totalBallots: cleanBallots.length,
    consensusOrder: rankedItems,
  };
}
