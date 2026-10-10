export function normalizeFileDisplayName(draft: string, originalName: string): string | undefined {
  const name = draft.trim();
  return name && name !== originalName ? name : undefined;
}
