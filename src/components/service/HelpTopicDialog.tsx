'use client';

import { fill } from '@/api/translator';
import { Dialog } from '@/components/ui';
import { useRegionCopy } from '@/hooks/useRegionCopy';
import type { HelpTopic } from '@/types/help';
import styles from './HelpTopicDialog.module.css';

interface HelpTopicDialogProps {
  topic: HelpTopic;
  open: boolean;
  onClose: () => void;
}

/**
 * A "More help" topic (payment help, allergens & FAQs) in a sheet / modal. Its text may name
 * region words as placeholders: `{paymentMethods}`, `{taxInvoice}`, `{currencyName}`.
 */
export function HelpTopicDialog({ topic, open, onClose }: HelpTopicDialogProps) {
  const region = useRegionCopy();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fill(topic.title, region)}
      description={fill(topic.intro, region)}
      presentation="adaptive"
    >
      <dl className={styles.list}>
        {topic.sections.map((section) => (
          <div key={section.heading} className={styles.item}>
            <dt className={styles.heading}>{fill(section.heading, region)}</dt>
            <dd className={styles.body}>{fill(section.body, region)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
