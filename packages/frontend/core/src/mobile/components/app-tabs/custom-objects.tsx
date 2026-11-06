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
  const [managerElement, setManagerElement] =
    useState<CustomObjectManager | null>(null);

  useEffect(() => {
    if (!customElements.get('affine-custom-object-manager')) {
      customElements.define('affine-custom-object-manager', CustomObjectManager);
    }

    managerElement?.setWorkspaceContext(workspace.id, workspace.rootYDoc);
  }, [managerElement, workspace]);

  const managerNode = createElement('affine-custom-object-manager', {
    ref: setManagerElement,
    'hide-trigger': '',
  });

  return (
    <>
      <TabItem
        id={tab.key}
        label="Oggetti"
        onClick={() => managerElement?.openPanel()}
      >
        <AllDocsIcon />
      </TabItem>
      {createPortal(managerNode, document.body)}
    </>
  );
};
