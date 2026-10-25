import type {ComponentType} from 'react';
import type {ClusterData} from './clusterData';
import {TwinLayout} from './twin/TwinLayout';

export interface ClusterLayoutProps {
  d: ClusterData;
  width: number;
  height: number;
  accent: string;
}

/** Every cluster layout (spec 2026-10-25, cluster mode): later ones are added here. */
export const CLUSTER_LAYOUTS: {id: string; name: string; Component: ComponentType<ClusterLayoutProps>}[] = [{id: 'twin', name: 'Twin', Component: TwinLayout}];

export const layoutById = (id: string) => CLUSTER_LAYOUTS.find((l) => l.id === id) ?? CLUSTER_LAYOUTS[0];
