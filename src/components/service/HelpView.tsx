'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Page } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Icon } from '@/components/ui';
import { VisitPill } from '@/components/layout/VisitPill';
import { useBranch, useContent, useHelpTopics, useRegion } from '@/api/hooks';
import { useVisit } from '@/context/GuestSessionContext';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { cx } from '@/lib/cx';
import type { HelpTopic } from '@/types/help';
import { HelpTopicDialog } from './HelpTopicDialog';
import { HoursCard } from './HoursCard';
import { SocialFollow } from './SocialFollow';
import { useTableVisit } from './useTableVisit';
import styles from './HelpView.module.css';

/** Takeaway and delivery: no waiter or bill to call; directions, tracking and the phone instead. */
function ModeActions({ mode }: { mode: 'takeaway' | 'delivery' }) {
  const branch = useBranch();
  const t = useContent('service');
  const track = (
    <Link
      className={cx(styles.action, mode === 'delivery' ? styles.actionWarm : styles.actionSand)}
      href="/orders/"
    >
      <span
        className={cx(styles.actionIcon, mode === 'delivery' ? styles.brand : styles.dark)}
        aria-hidden="true"
      >
        <Icon name={mode === 'delivery' ? 'scooter' : 'clock'} />
      </span>
      <span className={styles.actionText}>
        <span className={styles.actionTitle}>{t('help.modeActions.track.title')}</span>
        <span className={styles.actionSub}>{t('help.modeActions.track.sub')}</span>
      </span>
      <Icon name="chev" className={cx(styles.actionChev, 'hide-mobile')} />
    </Link>
  );
  if (mode === 'takeaway') {
    return (
      <div className={styles.actions}>
        <a
          className={cx(styles.action, styles.actionWarm)}
          href={branch.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('help.modeActions.directions.label', { branch: branch.shortName })}
        >
          <span className={cx(styles.actionIcon, styles.brand)} aria-hidden="true">
            <Icon name="pin" />
          </span>
          <span className={styles.actionText}>
            <span className={styles.actionTitle}>{t('help.modeActions.directions.title')}</span>
            <span className={styles.actionSub}>
              {t('help.modeActions.directions.sub', { branch: branch.shortName })}
            </span>
          </span>
          <Icon name="chev" className={cx(styles.actionChev, 'hide-mobile')} />
        </a>
        {track}
      </div>
    );
  }
  return (
    <div className={styles.actions}>
      {track}
      <a className={cx(styles.action, styles.actionSand)} href={branch.phoneHref}>
        <span className={cx(styles.actionIcon, styles.dark)} aria-hidden="true">
          <Icon name="phone" />
        </span>
        <span className={styles.actionText}>
          <span className={styles.actionTitle}>{t('help.modeActions.call.title')}</span>
          <span className={styles.actionSub}>{t('help.modeActions.call.sub')}</span>
        </span>
        <Icon name="chev" className={cx(styles.actionChev, 'hide-mobile')} />
      </a>
    </div>
  );
}

/** Service & help (17 · w17); takeaway and delivery guests get directions, tracking and the phone instead of table service. */
export function HelpView() {
  const branch = useBranch();
  const t = useContent('service');
  const { clock } = useRegion();
  const { mode } = useVisit();
  const { table, latest } = useTableVisit();
  const { openRequest, requests } = useServiceRequest();
  const topics = useHelpTopics();
  const [topicId, setTopicId] = useState<HelpTopic['id']>('payment');
  const [topicOpen, setTopicOpen] = useState(false);
  const showTopic = (id: HelpTopic['id']) => {
    setTopicId(id);
    setTopicOpen(true);
  };
  const orderHref = latest ? `/order/${latest.id}/` : '/orders/';

  return (
    <Page>
      <SiteHeader />
      <main id="main" className={styles.main}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <h1 className={styles.title}>{t('help.title')}</h1>
            <p className={cx('t-body c2 hide-mobile')}>
              {mode === 'dineIn'
                ? t('help.lede', { table })
                : t(`help.modeLede.${mode}`, { branch: branch.shortName })}
            </p>
          </div>
          <VisitPill className="hide-desktop" />
        </div>

        {mode !== 'dineIn' ? (
          <ModeActions mode={mode} />
        ) : (
          <div className={styles.actions}>
            <button
              type="button"
              className={cx(styles.action, styles.actionWarm)}
              onClick={() => openRequest('waiter')}
            >
              <span className={cx(styles.actionIcon, styles.brand)} aria-hidden="true">
                <Icon name="bell" />
              </span>
              <span className={styles.actionText}>
                <span className={styles.actionTitle}>
                  <span className="hide-desktop">{t('waiterDialog.reasons.waiter')}</span>
                  <span className="hide-mobile">{t('shared.callAWaiter')}</span>
                </span>
                <span className={styles.actionSub}>
                  {requests.waiter ? (
                    <span className={styles.pending}>
                      {t('shared.requestedAt', { time: clock.time(requests.waiter.requestedAt) })}
                    </span>
                  ) : (
                    <>
                      <span className="hide-desktop">{t('help.waiter.subMobile')}</span>
                      <span className="hide-mobile">{t('help.waiter.subDesktop')}</span>
                    </>
                  )}
                </span>
              </span>
              <Icon name="chev" className={cx(styles.actionChev, 'hide-mobile')} />
            </button>

            <button
              type="button"
              className={cx(styles.action, styles.actionSand)}
              onClick={() => openRequest('bill')}
            >
              <span className={cx(styles.actionIcon, styles.dark)} aria-hidden="true">
                <Icon name="receipt" />
              </span>
              <span className={styles.actionText}>
                <span className={styles.actionTitle}>
                  <span className="hide-desktop">{t('shared.requestBill')}</span>
                  <span className="hide-mobile">{t('shared.requestTheBill')}</span>
                </span>
                <span className={styles.actionSub}>
                  {requests.bill ? (
                    <span className={styles.pending}>
                      {t('shared.requestedAt', { time: clock.time(requests.bill.requestedAt) })}
                    </span>
                  ) : (
                    <>
                      <span className="hide-desktop">{t('help.bill.subMobile', { table })}</span>
                      <span className="hide-mobile">{t('help.bill.subDesktop')}</span>
                    </>
                  )}
                </span>
              </span>
              <Icon name="chev" className={cx(styles.actionChev, 'hide-mobile')} />
            </button>
          </div>
        )}

        <div className={styles.grid}>
          <section className={styles.more} aria-labelledby="more-help">
            <h2 id="more-help" className={cx('t-caption c3', styles.moreTitle)}>
              {t('help.more.title')}
            </h2>
            <ul className={styles.list}>
              <li>
                <a className={styles.row} href={branch.phoneHref}>
                  <RowContent icon="phone" title={t('help.more.call')} sub={branch.phone} />
                </a>
              </li>
              <li>
                <Link className={styles.row} href={orderHref}>
                  <RowContent
                    icon="flag"
                    title={t('help.more.problem')}
                    sub={t('help.more.problemSub')}
                  />
                </Link>
              </li>
              <li>
                <button type="button" className={styles.row} onClick={() => showTopic('payment')}>
                  <RowContent
                    icon="card"
                    title={t('help.more.payment')}
                    sub={t('help.more.paymentSub')}
                  />
                </button>
              </li>
              <li>
                <button type="button" className={styles.row} onClick={() => showTopic('faqs')}>
                  <RowContent
                    icon="help"
                    title={t('help.more.faqs')}
                    sub={t('help.more.faqsSub')}
                  />
                </button>
              </li>
            </ul>
          </section>
          <div className={styles.side}>
            {/* <HoursCard /> */}
            <SocialFollow />
          </div>
        </div>
      </main>
      <BottomNav />
      <HelpTopicDialog
        topic={topics[topicId]}
        open={topicOpen}
        onClose={() => setTopicOpen(false)}
      />
    </Page>
  );
}

function RowContent({
  icon,
  title,
  sub,
}: {
  icon: 'phone' | 'flag' | 'card' | 'help';
  title: string;
  sub: string;
}) {
  return (
    <>
      <span className={styles.rowIcon} aria-hidden="true">
        <Icon name={icon} size="sm" />
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowSub}>{sub}</span>
      </span>
      <Icon name="chev" size="sm" className={styles.rowChev} />
    </>
  );
}
