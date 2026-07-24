export interface CommunityCrosscheck {
  sourceId: string;
  rosterCount?: number;
  moveCount?: number;
  itemCount?: number;
  differences: string[];
  isAuthority: false;
}

export function importChampionsCommunityCrosscheck(input: unknown): CommunityCrosscheck {
  const crosscheck = input as Partial<CommunityCrosscheck>;
  if (!crosscheck.sourceId) throw new Error('community crosscheck requires sourceId');
  return {
    sourceId: crosscheck.sourceId,
    rosterCount: crosscheck.rosterCount,
    moveCount: crosscheck.moveCount,
    itemCount: crosscheck.itemCount,
    differences: crosscheck.differences ?? [],
    isAuthority: false,
  };
}
