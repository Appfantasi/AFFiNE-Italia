import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const errorLayout = style({
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'center',
  width: '100%',
  height: '100%',
  minHeight: '100dvh',
  boxSizing: 'border-box',
  overflowY: 'auto',
  overflowX: 'hidden',
  paddingTop: 'max(12px, env(safe-area-inset-top))',
  paddingRight: 'max(12px, env(safe-area-inset-right))',
  paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
  paddingLeft: 'max(12px, env(safe-area-inset-left))',
  transition: 'all 0.3s ease-in-out',
  WebkitOverflowScrolling: 'touch',
});

export const errorContainer = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start',
  minHeight: 'min-content',
  width: '100%',
  gap: '8px',
  padding: '16px',
  margin: 'auto 0',
  boxSizing: 'border-box',
  maxWidth: '400px',
  flexShrink: 0,
  transition: 'max-width 0.3s ease-in-out',
  selectors: {
    '&[data-show-stack="true"]': {
      maxWidth: '600px',
    },
  },
  '@media': {
    '(max-width: 600px), (max-height: 600px)': {
      padding: '8px',
      gap: '6px',
    },
  },
});

export const label = style({
  width: '100%',
  overflow: 'hidden',
  textWrap: 'wrap',
  wordBreak: 'break-word',
});

export const scrollArea = style({
  height: 'auto',
  maxHeight: 0,
  transition: 'max-height 0.3s ease-in-out',
  color: cssVarV2('text/secondary'),
  fontSize: 14,
  lineHeight: '22px',
  fontWeight: 400,
  selectors: {
    '&[data-show-stack="true"]': {
      maxHeight: '200px',
    },
  },
});

export const illustration = style({
  maxWidth: '100%',
  width: 300,
  alignSelf: 'center',
  flexShrink: 0,
  '@media': {
    '(max-width: 600px), (max-height: 600px)': {
      width: 160,
    },
  },
});

export const text = style({
  fontSize: 14,
  lineHeight: '22px',
  fontWeight: 400,
  color: cssVarV2('text/primary'),
  marginBottom: 4,
});

export const actionContainer = style({
  display: 'flex',
  flexWrap: 'wrap',
  marginTop: '12px',
  width: '100%',
  gap: '12px',
  justifyContent: 'center',
  alignItems: 'center',
  flexShrink: 0,
});

export const actionButton = style({
  padding: '8px 12px',
  fontSize: 12,
  minWidth: '120px',
  minHeight: '40px',
});

export const actionContent = style({
  display: 'flex',
  alignItems: 'center',
});

export const arrowIcon = style({
  transition: 'transform 0.3s ease-in-out',
  marginLeft: '8px',
  width: '16px',
  height: '16px',
  selectors: {
    '&[data-show-stack="true"]': {
      transform: 'rotate(180deg)',
    },
  },
});
