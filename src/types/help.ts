/** A "More help" topic on the Help page that opens in a dialog. */
export interface HelpTopic {
  id: 'payment' | 'faqs';
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
}

/** GET /help: every topic by id. */
export type HelpTopics = Record<HelpTopic['id'], HelpTopic>;
