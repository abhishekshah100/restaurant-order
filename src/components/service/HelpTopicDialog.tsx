'use client';

import { Dialog } from '@/components/ui';
import type { HelpTopic } from '@/types/help';
import styles from './HelpTopicDialog.module.css';

interface HelpTopicDialogProps {
  topic: HelpTopic;
  open: boolean;
  onClose: () => void;
}

/** A "More help" topic (payment help, allergens & FAQs) in a sheet / modal. */
export function HelpTopicDialog({ topic, open, onClose }: HelpTopicDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={topic.title}
      description={topic.intro}
      presentation="adaptive"
    >
      <dl className={styles.list}>
        {topic.sections.map((section) => (
          <div key={section.heading} className={styles.item}>
            <dt className={styles.heading}>{section.heading}</dt>
            <dd className={styles.body}>{section.body}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
