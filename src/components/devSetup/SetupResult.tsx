'use client';

import { useState } from 'react';
import type { SetupImportResponse } from '@/api/contracts';
import { useContent } from '@/api/hooks';
import { Banner, Button } from '@/components/ui';
import { guestTableLink } from '@/lib/devSetup';
import styles from './DevSetup.module.css';

/** A value with a Copy button ("Copied" for a moment after). */
function Copyable({ value }: { value: string }) {
  const t = useContent('common');
  const [copied, setCopied] = useState(false);
  return (
    <span className={styles.copyable}>
      <code>{value}</code>
      <Button
        variant="ghost"
        size="sm"
        iconStart={copied ? 'check' : 'copy'}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? t('devSetup.import.copied') : t('devSetup.import.copy')}
      </Button>
    </span>
  );
}

/** What an import made: the links to open and every staff sign-in (passwords shown only now). */
export function SetupResult({ result }: { result: SetupImportResponse }) {
  const t = useContent('common');
  const origin = window.location.origin;
  const [first] = result.tables;
  const name = result.restaurant.name;
  // Their sign-in under the client's name, not the default branch's.
  const staffLink = `${origin}/admin/login/?branch=${encodeURIComponent(result.branch.id)}`;
  return (
    <div className={styles.answer}>
      <Banner tone="ok" live="polite">
        {result.replaced
          ? t('devSetup.import.replaced', { name })
          : t('devSetup.import.done', { name })}
      </Banner>
      {result.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <h3 className={styles.subTitle}>{t('devSetup.import.links')}</h3>
      <dl className={styles.summary}>
        {first && (
          <>
            <dt>{t('devSetup.import.guestLink')}</dt>
            <dd>
              <a
                href={guestTableLink(origin, result.branch.id, first)}
                target="_blank"
                rel="noreferrer"
              >
                {guestTableLink(origin, result.branch.id, first)}
              </a>
            </dd>
          </>
        )}
        <dt>{t('devSetup.import.staffLink')}</dt>
        <dd>
          <a href={staffLink} target="_blank" rel="noreferrer">
            {staffLink}
          </a>
        </dd>
      </dl>
      <details className={styles.details}>
        <summary>{t('devSetup.import.allTables')}</summary>
        <ul className={styles.tableLinks}>
          {result.tables.map((table) => (
            <li key={table.number}>
              <span className={styles.tableNumber}>{table.number}</span>
              <Copyable value={guestTableLink(origin, result.branch.id, table)} />
            </li>
          ))}
        </ul>
      </details>

      <h3 className={styles.subTitle}>{t('devSetup.import.staff')}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('devSetup.import.columns.name')}</th>
              <th scope="col">{t('devSetup.import.columns.role')}</th>
              <th scope="col">{t('devSetup.import.columns.signIn')}</th>
              <th scope="col">{t('devSetup.import.columns.password')}</th>
            </tr>
          </thead>
          <tbody>
            {result.staff.map((s) => (
              <tr key={s.email}>
                <td>{s.name}</td>
                <td>{t(`devSetup.roles.${s.role}`)}</td>
                <td>
                  <span className={styles.stack}>
                    <span>{s.phoneNational}</span>
                    <span className={styles.muted}>{s.email}</span>
                  </span>
                </td>
                <td>
                  <Copyable value={s.password} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
