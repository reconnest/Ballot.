import type { RankedPointsResult } from "@/lib/ranking";

export const CHART_COLORS = [
  "#0F766E", // Teal (brand)
  "#2563EB", // Blue
  "#7C3AED", // Purple
  "#DB2777", // Pink
  "#D97706", // Amber
  "#059669", // Emerald
  "#DC2626", // Red
  "#4B5563", // Gray
  "#4338CA", // Indigo
  "#0891B2", // Cyan
];

export type ChartDataPoint = {
  id: string;
  label: string;
  votes: number;
  pct: number;
  color: string;
};

/**
 * Calculates SVG Donut / Pie path coordinates for slices.
 */
export function calculateSlices(
  items: { id: string; label: string; votes: number }[],
  total: number,
  radius: number = 90,
  innerRadius: number = 55
) {
  let cumulativeAngle = 0;

  return items.map((item, idx) => {
    const pct = total > 0 ? (item.votes / total) * 100 : 0;
    const angle = total > 0 ? (item.votes / total) * 360 : 0;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const color = CHART_COLORS[idx % CHART_COLORS.length];

    // Coordinates for outer and inner arcs
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = 120 + radius * Math.cos(startRad);
    const y1 = 120 + radius * Math.sin(startRad);
    const x2 = 120 + radius * Math.cos(endRad);
    const y2 = 120 + radius * Math.sin(endRad);

    const x3 = 120 + innerRadius * Math.cos(endRad);
    const y3 = 120 + innerRadius * Math.sin(endRad);
    const x4 = 120 + innerRadius * Math.cos(startRad);
    const y4 = 120 + innerRadius * Math.sin(startRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    let path = "";
    if (angle >= 359.99) {
      // Full circle donut
      path = `M 120,${120 - radius} A ${radius},${radius} 0 1,0 120,${120 + radius} A ${radius},${radius} 0 1,0 120,${120 - radius} M 120,${120 - innerRadius} A ${innerRadius},${innerRadius} 0 1,1 120,${120 + innerRadius} A ${innerRadius},${innerRadius} 0 1,1 120,${120 - innerRadius} Z`;
    } else if (angle > 0) {
      path = `M ${x1},${y1} A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2} L ${x3},${y3} A ${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${x4},${y4} Z`;
    }

    return {
      ...item,
      pct: Math.round(pct),
      color,
      path,
    };
  });
}

/**
 * Generates and downloads a CSV export of poll results.
 */
export function exportToCSV(
  question: string,
  options: { label: string; votes: number }[],
  totalVotes: number,
  voters?: { name: string; choices: string[] }[],
  pollType: string = "standard",
  rankedPointsResult?: RankedPointsResult | null
) {
  const isRanked = pollType === "ranked_choice" || pollType === "ranked";
  const rows: string[][] = [
    ["Poll Question", `"${question.replace(/"/g, '""')}"`],
    ["Poll Format", isRanked ? "Ranked Choice (Consensus Points)" : "Standard Poll"],
    ["Total Ballots Cast", totalVotes.toString()],
    ["Export Date", new Date().toISOString()],
    [],
  ];

  if (isRanked && rankedPointsResult && rankedPointsResult.leaderboard && rankedPointsResult.leaderboard.length > 0) {
    rows.push(["Rank", "Option", "Consensus Points", "1st Choice Votes", "Score Share"]);
    for (const item of rankedPointsResult.leaderboard) {
      rows.push([
        item.rank.toString(),
        `"${item.label.replace(/"/g, '""')}"`,
        item.totalPoints.toString(),
        item.firstChoiceVotes.toString(),
        `${item.scorePct}%`,
      ]);
    }
  } else {
    rows.push(["Option", "Votes", "Percentage"]);
    for (const o of options) {
      const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
      rows.push([`"${o.label.replace(/"/g, '""')}"`, o.votes.toString(), `${pct}%`]);
    }
  }

  if (voters && voters.length > 0) {
    rows.push([]);
    rows.push([isRanked ? "--- Individual Voter Rankings ---" : "--- Voter Attendance & Selections ---"]);
    rows.push(["Voter Name", isRanked ? "Ranked Order (1st > 2nd > 3rd...)" : "Selected Choice(s)"]);
    for (const v of voters) {
      const choicesStr = (v.choices || []).join(isRanked ? " > " : ", ");
      rows.push([
        `"${(v.name || "Anonymous").replace(/"/g, '""')}"`,
        `"${choicesStr.replace(/"/g, '""')}"`,
      ]);
    }
  }

  const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `ballot_results_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a JSON export of poll results.
 */
export function exportToJSON(pollData: unknown) {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(pollData, null, 2))}`;
  const link = document.createElement("a");
  link.setAttribute("href", jsonString);
  link.setAttribute("download", `ballot_export_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
