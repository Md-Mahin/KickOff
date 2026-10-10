/** No local coach dataset is maintained; coach details must come from provider data. */
export interface CoachInfo {
  name: string | null;
  photo: string | null;
}

export function getCoachForTeam(_teamId: number, _teamName?: string | null): CoachInfo {
  return { name: null, photo: null };
}
