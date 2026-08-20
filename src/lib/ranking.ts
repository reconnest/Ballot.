export type RankedPointsItem = {
  id: string;
  label: string;
  rank: number;
  totalPoints: number;
  scorePct: number;
  firstChoiceVotes: number;
  avgRank: number;
  status: string;
};

export type RankedPointsResult = {
  winner: RankedPointsItem | null;
  totalBallots: number;
  maxPointsPerBallot: number;
  totalPointsAwarded: number;
  leaderboard: RankedPointsItem[];
};

/**
 * Calculates Ranked Points (Borda Count) where 1st place earns N points,
 * 2nd place earns N-1 points, down to 1 point.
 */
export function calculateRankedPoints(
  options: { id: string; label: string; imageUrl?: string | null }[],
  ballots: string[][]
): RankedPointsResult {
  const N = options.length;
  const labelMap = new Map<string, string>();
  for (const opt of options) {
    labelMap.set(opt.id, opt.label);
  }

  if (N === 0 || ballots.length === 0) {
    return {
      winner: null,
      totalBallots: 0,
      maxPointsPerBallot: N,
      totalPointsAwarded: 0,
      leaderboard: options.map((o, i) => ({
        id: o.id,
        label: o.label,
        rank: i + 1,
        totalPoints: 0,
        scorePct: 0,
        firstChoiceVotes: 0,
        avgRank: 0,
        status: "No votes yet",
      })),
    };
  }

  const pointCounts = new Map<string, number>();
  const firstChoiceCounts = new Map<string, number>();
  const rankSumMap = new Map<string, number>();
  const rankedAppearances = new Map<string, number>();

  for (const opt of options) {
    pointCounts.set(opt.id, 0);
    firstChoiceCounts.set(opt.id, 0);
    rankSumMap.set(opt.id, 0);
    rankedAppearances.set(opt.id, 0);
  }

  let totalPointsAwarded = 0;
  let validBallotsCount = 0;

  for (const rawBallot of ballots) {
    // Filter to known option IDs and remove duplicates
    const ballot = Array.from(new Set(rawBallot.filter((id) => labelMap.has(id))));
    if (ballot.length === 0) continue;

    validBallotsCount++;

    ballot.forEach((optId, index) => {
      // 1st choice (index 0) gets N points, 2nd gets N-1, etc.
      const points = Math.max(1, N - index);
      pointCounts.set(optId, (pointCounts.get(optId) || 0) + points);
      totalPointsAwarded += points;

      if (index === 0) {
        firstChoiceCounts.set(optId, (firstChoiceCounts.get(optId) || 0) + 1);
      }

      rankSumMap.set(optId, (rankSumMap.get(optId) || 0) + (index + 1));
      rankedAppearances.set(optId, (rankedAppearances.get(optId) || 0) + 1);
    });
  }

  const leaderboard: RankedPointsItem[] = options.map((opt) => {
    const points = pointCounts.get(opt.id) || 0;
    const appearances = rankedAppearances.get(opt.id) || 0;
    const avgRank = appearances > 0 ? parseFloat(((rankSumMap.get(opt.id) || 0) / appearances).toFixed(1)) : 0;
    const scorePct = totalPointsAwarded > 0 ? Math.round((points / totalPointsAwarded) * 100) : 0;

    return {
      id: opt.id,
      label: opt.label,
      rank: 1,
      totalPoints: points,
      scorePct,
      firstChoiceVotes: firstChoiceCounts.get(opt.id) || 0,
      avgRank,
      status: "",
    };
  });

  // Sort descending by points, then by 1st choice votes, then by avg rank
  leaderboard.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.firstChoiceVotes !== a.firstChoiceVotes) return b.firstChoiceVotes - a.firstChoiceVotes;
    return a.avgRank - b.avgRank;
  });

  // Assign ranks & status
  leaderboard.forEach((item, idx) => {
    item.rank = idx + 1;
    if (idx === 0 && item.totalPoints > 0) {
      item.status = `Highest Score Leader (${item.totalPoints} pts)`;
    } else if (idx === 1 && item.totalPoints > 0) {
      item.status = `Runner-Up (${item.totalPoints} pts)`;
    } else if (item.totalPoints > 0) {
      item.status = `${item.totalPoints} pts · Avg Rank #${item.avgRank}`;
    } else {
      item.status = "0 pts";
    }
  });

  const winner = leaderboard.length > 0 && leaderboard[0].totalPoints > 0 ? leaderboard[0] : null;

  return {
    winner,
    totalBallots: validBallotsCount,
    maxPointsPerBallot: N,
    totalPointsAwarded,
    leaderboard,
  };
}
