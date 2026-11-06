'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_PROOFS } from '@/api/contracts';
import { useUploadPaymentProof, useUploadPurchaseProof } from '@/api/mutations';
import { resizeImage } from '@/lib/imageResize';

/** The longer side a proof photo is shrunk to before upload: a UPI screen stays readable. */
const PROOF_MAX_PX = 1600;

/** A proof photo staff picked: shown at once, uploaded meanwhile (its key once kept). */
export interface ProofPhoto {
  id: string;
  /** An object URL of the picked file, for the thumbnail. */
  preview: string;
  key?: string;
  failed?: true;
}

let nextId = 0;

/**
 * Proof photos for the parts of a payment, by row (a part's id): each is shrunk on the device
 * and uploaded as soon as it's picked (POST …/payment-proofs), so collecting doesn't wait. Up
 * to MAX_PROOFS a row. Thumbnails' object URLs are let go when a photo is removed and on close.
 */
export function useProofPhotos(branchId: string, kept: 'payments' | 'purchasing' = 'payments') {
  const payments = useUploadPaymentProof();
  const purchasing = useUploadPurchaseProof();
  const upload = (kept === 'purchasing' ? purchasing : payments).mutateAsync;
  const [byRow, setByRow] = useState<Readonly<Record<string, readonly ProofPhoto[]>>>({});
  const current = useRef(byRow);
  current.current = byRow;

  useEffect(
    () => () => {
      for (const photos of Object.values(current.current)) {
        for (const p of photos) URL.revokeObjectURL(p.preview);
      }
    },
    [],
  );

  const change = useCallback(
    (rowId: string, photoId: string, update: Partial<ProofPhoto>) =>
      setByRow((all) => ({
        ...all,
        [rowId]: (all[rowId] ?? []).map((p) => (p.id === photoId ? { ...p, ...update } : p)),
      })),
    [],
  );

  const add = useCallback(
    (rowId: string, files: readonly File[]) => {
      const room = MAX_PROOFS - (current.current[rowId]?.length ?? 0);
      const picked = files.filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, room));
      const added = picked.map((file) => ({
        file,
        photo: { id: `proof-${String((nextId += 1))}`, preview: URL.createObjectURL(file) },
      }));
      if (added.length === 0) return;
      setByRow((all) => ({
        ...all,
        [rowId]: [...(all[rowId] ?? []), ...added.map((a) => a.photo)],
      }));
      for (const { file, photo } of added) {
        resizeImage(file, PROOF_MAX_PX)
          .then(({ dataUrl }) => upload({ branchId, body: { dataUrl } }))
          .then(
            ({ key }) => change(rowId, photo.id, { key }),
            () => change(rowId, photo.id, { failed: true }),
          );
      }
    },
    [branchId, change, upload],
  );

  const remove = useCallback((rowId: string, photoId: string) => {
    setByRow((all) => {
      const photo = all[rowId]?.find((p) => p.id === photoId);
      if (photo) URL.revokeObjectURL(photo.preview);
      return { ...all, [rowId]: (all[rowId] ?? []).filter((p) => p.id !== photoId) };
    });
  }, []);

  /** A row's photos go to another (one way to pay became the first of several, or back). */
  const move = useCallback((from: string, to: string) => {
    setByRow((all) => {
      const { [from]: moved = [], ...rest } = all;
      return { ...rest, [to]: [...(rest[to] ?? []), ...moved] };
    });
  }, []);

  /** A row and its photos gone (removed, or its way became cash). */
  const drop = useCallback((rowId: string) => {
    setByRow((all) => {
      const { [rowId]: dropped = [], ...rest } = all;
      for (const p of dropped) URL.revokeObjectURL(p.preview);
      return rest;
    });
  }, []);

  const photosOf = useCallback((rowId: string) => byRow[rowId] ?? [], [byRow]);
  const keysOf = useCallback(
    (rowId: string) => (byRow[rowId] ?? []).flatMap((p) => (p.key ? [p.key] : [])),
    [byRow],
  );
  /** Still uploading, or failed and not removed: the payment waits (nothing is sent half). */
  const unsettled = (rowIds: readonly string[]) =>
    rowIds.some((id) => (byRow[id] ?? []).some((p) => !p.key));

  return { add, remove, move, drop, photosOf, keysOf, unsettled };
}

export type ProofPhotos = ReturnType<typeof useProofPhotos>;
