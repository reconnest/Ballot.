export interface PollOption {
  id: string;
  label: string;
  imageUrl?: string | null;
  votes?: number | null;
  slotDetails?: string | null;
  position?: number;
}

export interface PollCreator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface RankedResult {
  winner: string | null;
  scores: Record<string, number>;
  rounds?: unknown[];
  tie?: boolean;
}

export type PollType = "standard" | "ranked_choice" | "image" | "availability";
export type PollSecurityMode = "unlimited" | "relaxed" | "standard" | "strict" | "none";
export type ResultsVisibility = "always_public" | "after_vote" | "after_deadline" | "creator_only";
export type PollStatus = "live" | "inactive" | "deleted";

export interface Poll {
  id: string;
  slug: string;
  question: string;
  description?: string | null;
  pollType: PollType;
  category?: string | null;
  status: PollStatus;
  securityMode: PollSecurityMode;
  resultsVisibility: ResultsVisibility;
  allowMultiple: boolean;
  allowVoteEdit: boolean;
  isPublic: boolean;
  requireName: boolean;
  minChoices?: number;
  maxChoices?: number | null;
  createdAt: number;
  expiresAt?: number | null;
  isExpired?: boolean;
  isInactive?: boolean;
  repolledFrom?: string | null;
  creator?: PollCreator | null;
  creatorName?: string | null;
  options: PollOption[];
  totalVotes?: number | null;
  totalSelections?: number | null;
  myVote?: string | null;
  myVotes?: string[];
  hasVoted?: boolean;
  canViewResults?: boolean;
  isAdmin?: boolean;
  voters?: Array<{ name: string; choices: string[] }>;
  rankedPointsResult?: RankedResult | null;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: number;
}
