'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Page } from '@/components/layout/Shells';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Icon, TablePill } from '@/components/ui';
import { useContent, useHelpTopics, useRestaurant } from '@/api/hooks';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { cx } from '@/lib/cx';
import { formatTime } from '@/lib/format';
import type { HelpTopic } from '@/types/help';
import { telHref } from '@/lib/service';
import { HelpTopicDialog } from './HelpTopicDialog';
import { HoursCard } from './HoursCard';
import { SocialFollow } from './SocialFollow';
import { useTableOrders } from './useTableOrders';
import styles from './HelpView.module.css';

/** Service & help (17 · w17). */
export function HelpView() {
  const restaurant = useRestaurant();
  const t = useContent('service');
  const { table, latest } = useTableOrders();
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
            <p className={cx('t-body c2 hide-mobile')}>{t('help.lede', { table })}</p>
          </div>
          <TablePill table={table} className="hide-desktop" />
        </div>

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
                    {t('shared.requestedAt', { time: formatTime(requests.waiter.requestedAt) })}
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
                    {t('shared.requestedAt', { time: formatTime(requests.bill.requestedAt) })}
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

        <div className={styles.grid}>
          <section className={styles.more} aria-labelledby="more-help">
            <h2 id="more-help" className={cx('t-caption c3', styles.moreTitle)}>
              {t('help.more.title')}
            </h2>
            <ul className={styles.list}>
              <li>
                <a className={styles.row} href={telHref(restaurant.phone)}>
                  <RowContent icon="phone" title={t('help.more.call')} sub={restaurant.phone} />
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
