'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useContent } from '@/api/hooks';
import { Button, Icon, type IconName } from '@/components/ui';
import { useServiceRequest } from '@/context/ServiceRequestContext';
import { cx } from '@/lib/cx';
import styles from './OrderActions.module.css';

function Tile({
  icon,
  children,
  ...action
}: { icon: IconName; children: ReactNode } & (
  { href: string; onClick?: undefined } | { href?: undefined; onClick: () => void }
)) {
  const content = (
    <>
      <Icon name={icon} />
      <span className={styles.tileLabel}>{children}</span>
    </>
  );
  return action.href ? (
    <Link href={action.href} className={styles.tile}>
      {content}
    </Link>
  ) : (
    <button type="button" className={styles.tile} onClick={action.onClick}>
      {content}
    </button>
  );
}

/**
 * Service shortcuts on the tracking screen: a bottom bar (Call waiter · Help) on mobile,
 * three tiles (Call waiter · Request bill · Get help) on the web. Without waiter requests in the
 * package, Help only.
 */
export function OrderActions() {
  const { openRequest, available } = useServiceRequest();
  const t = useContent('orders');
  return (
    <>
      <div className={cx(styles.tiles, 'hide-mobile')}>
        {available && (
          <>
            <Tile icon="bell" onClick={() => openRequest('waiter')}>
              {t('actions.callWaiter')}
            </Tile>
            <Tile icon="receipt" onClick={() => openRequest('bill')}>
              {t('actions.requestBill')}
            </Tile>
          </>
        )}
        <Tile icon="help" href="/help/">
          {t('actions.getHelp')}
        </Tile>
      </div>
      <div className={cx(styles.bar, 'hide-desktop')}>
        {available && (
          <Button variant="secondary" block iconStart="bell" onClick={() => openRequest('waiter')}>
            {t('actions.callWaiter')}
          </Button>
        )}
        <Button href="/help/" variant="secondary" block iconStart="help">
          {t('actions.help')}
        </Button>
      </div>
    </>
  );
}
