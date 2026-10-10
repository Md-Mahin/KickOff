/**
 * Compatibility exports for editors or scripts still referencing the former
 * mock repository. This module intentionally contains no fixture data and
 * never generates fallback matches.
 */
import type { BasicMatchItem } from "./matchTypes";
import type { MatchDetails } from "./matchTypes";

export type { BasicMatchItem } from "./matchTypes";
export type DetailedMockMatch = MatchDetails;

export const MOCK_BASIC_MATCHES: BasicMatchItem[] = [];
export const MOCK_DETAILED_MATCHES: Record<number, DetailedMockMatch> = {};
