'use client';

import { createContext, useContext } from 'react';

/**
 * The id of the branch the guest is at: their session's branch. GuestSessionProvider sets it;
 * null before the session is read (prerender and the first client render), which means the
 * brand's default branch.
 */
export const ActiveBranchContext = createContext<string | null>(null);

export const useActiveBranchId = (): string | null => useContext(ActiveBranchContext);
