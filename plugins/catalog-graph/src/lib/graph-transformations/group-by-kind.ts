/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DEFAULT_NAMESPACE, Entity } from '@backstage/catalog-model';
import { EntityNode } from '../types';
import { GraphTransformer } from './types';

const GROUP_MIN_SIZE = 2;
const GROUP_ID_PREFIX = 'kind-group:';

/**
 * Options for the group-by-kind transformation.
 */
export type GroupByKindOptions = {
  /**
   * IDs of the group nodes that are currently expanded.
   */
  expandedGroups: ReadonlySet<string>;
  /**
   * Called with the ID of a group node when it is clicked.
   */
  onToggleGroup: (groupId: string) => void;
};

function createGroupNode(options: {
  id: string;
  kind: string;
  count: number;
  index: number;
  expanded: boolean;
  onClick: () => void;
}): EntityNode {
  const { id, kind, count, index, expanded, onClick } = options;
  const name = `${kind.toLowerCase()}-group-${index}`;
  const title = `${kind} (${count}) ${expanded ? '▾' : '▸'}`;
  const entity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: { name, namespace: DEFAULT_NAMESPACE, title },
  };

  return {
    id,
    entity,
    focused: false,
    color: 'primary',
    // @deprecated
    kind,
    name,
    namespace: DEFAULT_NAMESPACE,
    title,
    spec: undefined,
    onClick,
  };
}

/**
 * Replaces nodes of the same kind, at the same distance from the root and
 * related to the same closer nodes, with a single group node showing their
 * count. Edges of the members are re-pointed to the group node.
 *
 * Nodes that are only reachable through a collapsed group are hidden. When a
 * group is expanded, the group node stays as a hub between the closer nodes
 * and the members, and the members get their own nodes and edges again.
 *
 * Requires the 'set-distances' transformation to have run before.
 */
export function createGroupByKindTransformer(
  options: GroupByKindOptions,
): GraphTransformer {
  const { expandedGroups, onToggleGroup } = options;

  return ctx => {
    const { nodes, edges, nodeDistances } = ctx;

    const nodesByDistance = new Map<number, EntityNode[]>();
    for (const node of nodes) {
      const distance = nodeDistances.get(node.id);
      if (node.focused || distance === undefined) {
        continue;
      }
      const nodesAtDistance = nodesByDistance.get(distance) ?? [];
      nodesAtDistance.push(node);
      nodesByDistance.set(distance, nodesAtDistance);
    }

    const closerNeighbours = new Map<string, Set<string>>();
    for (const edge of edges) {
      const fromDistance = nodeDistances.get(edge.from);
      const toDistance = nodeDistances.get(edge.to);
      if (
        fromDistance === undefined ||
        toDistance === undefined ||
        fromDistance === toDistance
      ) {
        continue;
      }
      const [closer, farther] =
        fromDistance < toDistance ? [edge.from, edge.to] : [edge.to, edge.from];
      const neighbours = closerNeighbours.get(farther) ?? new Set<string>();
      neighbours.add(closer);
      closerNeighbours.set(farther, neighbours);
    }

    const collapsedMembers = new Map<string, string>();
    const expandedMembers = new Map<string, string>();
    const hidden = new Set<string>();
    const groupNodes: EntityNode[] = [];

    for (const distance of [...nodesByDistance.keys()].sort((a, b) => a - b)) {
      const candidates = new Map<string, EntityNode[]>();
      for (const node of nodesByDistance.get(distance)!) {
        const closer = [...(closerNeighbours.get(node.id) ?? [])];
        if (
          closer.length > 0 &&
          closer.every(id => collapsedMembers.has(id) || hidden.has(id))
        ) {
          hidden.add(node.id);
          continue;
        }
        const parents = new Set(
          closer.map(id => collapsedMembers.get(id) ?? id),
        );
        const key = `${node.entity.kind.toLowerCase()}:${[...parents]
          .sort()
          .join(',')}`;
        const members = candidates.get(key) ?? [];
        members.push(node);
        candidates.set(key, members);
      }

      for (const [key, members] of candidates) {
        if (members.length < GROUP_MIN_SIZE) {
          continue;
        }
        const id = `${GROUP_ID_PREFIX}${distance}:${key}`;
        const expanded = expandedGroups.has(id);
        groupNodes.push(
          createGroupNode({
            id,
            kind: members[0].entity.kind,
            count: members.length,
            index: groupNodes.length + 1,
            expanded,
            onClick: () => onToggleGroup(id),
          }),
        );
        nodeDistances.set(id, distance);
        for (const member of members) {
          (expanded ? expandedMembers : collapsedMembers).set(member.id, id);
        }
      }
    }

    if (groupNodes.length === 0) {
      return;
    }

    ctx.nodes = [
      ...nodes.filter(
        node => !collapsedMembers.has(node.id) && !hidden.has(node.id),
      ),
      ...groupNodes,
    ];

    const resolve = (id: string) => collapsedMembers.get(id) ?? id;
    const distanceOf = (id: string) =>
      nodeDistances.get(id) ?? Number.POSITIVE_INFINITY;

    ctx.edges = edges.flatMap(edge => {
      if (hidden.has(edge.from) || hidden.has(edge.to)) {
        return [];
      }
      const from = resolve(edge.from);
      const to = resolve(edge.to);
      if (from === to) {
        return [];
      }
      // Edges between an expanded member and a closer node go through the hub
      const fromHub = expandedMembers.get(from);
      if (fromHub && distanceOf(to) < distanceOf(from)) {
        return [
          { ...edge, from: fromHub, to },
          { ...edge, from, to: fromHub },
        ];
      }
      const toHub = expandedMembers.get(to);
      if (toHub && distanceOf(from) < distanceOf(to)) {
        return [
          { ...edge, from, to: toHub },
          { ...edge, from: toHub, to },
        ];
      }
      return [{ ...edge, from, to }];
    });
  };
}
