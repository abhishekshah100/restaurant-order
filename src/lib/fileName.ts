/*
 * Names of the files staff download (bills, reports, exports): who they're from, as the branch
 * is named now — never its id, which stays the same when a branch is renamed.
 */

/** Text a file name can hold: no characters file systems refuse, single spaces. */
export const safeFileName = (text: string) =>
  text
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/** "The Olive Table - Rooftop Cafe": the company, then the branch (once, when they're alike). */
export const fileOwner = (company: string, branch: string) =>
  safeFileName(company === branch || !branch ? company : `${company} - ${branch}`);
