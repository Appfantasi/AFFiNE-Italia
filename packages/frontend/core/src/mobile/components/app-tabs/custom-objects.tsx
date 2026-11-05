import { WorkspaceService } from '@affine/core/modules/workspace';
import { CustomObjectManager } from '@blocksuite/affine-block-database';
import { AllDocsIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { createElement, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { TabItem } from './tab-item';
import type { AppTabCustomFCProps } from './type';

export const AppTabCustomObjects = ({ tab }: AppTabCustomFCProps) => {
  const workspace = useService(WorkspaceService).workspace;
  const managerRef = useRef<CustomObjectManager | null>(null);

  useEffect(() => {
    if (!customElements.get('affine-custom-object-manager')) {
      customElements.define('affine-custom-object-manager', CustomObjectManager);
    }
    managerRef.current?.setWorkspaceContext(workspace.id, workspace.rootYDoc);
  }, [workspace]);

  const manager = createElement('affine-custom-object-manager', {
    ref: managerRef,
    'hide-trigger': '',
  });

  return (
    <>
      <TabItem
        id={tab.key}
        label="Oggetti"
        onClick={() => managerRef.current?.openPanel()}
      >
        <AllDocsIcon />
      </TabItem>
      {createPortal(manager, document.body)}
    </>
  );
};
