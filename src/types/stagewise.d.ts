declare module '@stagewise/toolbar-react' {
  import React from 'react';
  export const StagewiseToolbar: React.ComponentType<{ config: any }>;
}

declare module '@stagewise/toolbar' {
  export function initToolbar(config: any): void;
} 