import { AllDocsIcon, HomeIcon } from '@blocksuite/icons/rc';

import { AppTabCreate } from './create';
import { AppTabJournal } from './journal';
import { AppTabCustomObjects } from './custom-objects';
import type { Tab } from './type';

export const tabs: Tab[] = [
  {
    key: 'home',
    to: '/home',
    Icon: HomeIcon,
  },
  {
    key: 'all',
    to: '/all',
    Icon: AllDocsIcon,
  },
  {
    key: 'objects',
    custom: AppTabCustomObjects,
  },
  {
    key: 'journal',
    custom: AppTabJournal,
  },
  {
    key: 'new',
    custom: AppTabCreate,
  },
];
