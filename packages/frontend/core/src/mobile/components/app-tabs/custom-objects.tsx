import { WorkspaceService } from '@affine/core/modules/workspace';
import { CustomObjectManager } from '@blocksuite/affine-block-database';
import { AllDocsIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { createElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { TabItem } from './tab-item';
import type { AppTabCustomFCProps } from './type';

export const AppTabCustomObjects = ({ tab }: AppTabCustomFCProps) => {
  const workspace = useService(WorkspaceService).workspace;
  const [manager, setManager] = useState<CustomObjectManager | null>(null);

  useEffect(() => {
    if (!customElements.get('affine-custom-object-manager')) {
      customElements.define('affine-custom-object-manager', CustomObjectManager);
    }
    manager?.setWorkspaceContext(workspace.id, workspace.rootYDoc);
  }, [manager, workspace]);

  const manager = createElement('affine-custom-object-manager', {
    ref: setManager,
    'hide-trigger': '',
  });

  return (
    <>
      <TabItem
        id={tab.key}
        label="Oggetti"
        onClick={() => manager?.openPanel()}
      >
        <AllDocsIcon />
      </TabItem>
      {createPortal(manager, document.body)}
    </>
  );
};
