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

import { parseEntityRef } from '@backstage/catalog-model';
import { EntityEdge, EntityNode } from '../types';
import { createGroupByKindTransformer } from './group-by-kind';
import { setDistances } from './set-distance';
import { TransformationContext } from './types';

const ROOT = 'group:default/team';
const COMPONENT_GROUP = 'kind-group:1:component:group:default/team';
const RESOURCE_GROUP = 'kind-group:1:resource:group:default/team';

function node(ref: string): EntityNode {
  const { kind, namespace, name } = parseEntityRef(ref);
  return {
    id: ref,
    entity: { apiVersion: 'a', kind, metadata: { name, namespace } },
    focused: ref === ROOT,
    name,
    namespace,
  };
}

function edge(from: string, to: string, relation: string): EntityEdge {
  return { from, to, relations: [relation], label: 'visible' };
}

/*
  team -> c1, c2 (ownerOf)          c1 -> db1, c2 -> db2 (dependsOn)
  team -> r2 (ownerOf), r1 -> team (ownedBy)
  team -> a1 (ownerOf)              a1 -> db3 (dependsOn)
  u1 has no relations
*/
function createContext(): TransformationContext {
  const ctx: TransformationContext = {
    nodeDistances: new Map(),
    nodes: [
      ROOT,
      'component:default/c1',
      'component:default/c2',
      'resource:default/r1',
      'resource:default/r2',
      'api:default/a1',
      'resource:default/db1',
      'resource:default/db2',
      'resource:default/db3',
      'user:default/u1',
    ].map(node),
    edges: [
      edge(ROOT, 'component:default/c1', 'ownerOf'),
      edge(ROOT, 'component:default/c2', 'ownerOf'),
      edge('resource:default/r1', ROOT, 'ownedBy'),
      edge(ROOT, 'resource:default/r2', 'ownerOf'),
      edge(ROOT, 'api:default/a1', 'ownerOf'),
      edge('component:default/c1', 'resource:default/db1', 'dependsOn'),
      edge('component:default/c2', 'resource:default/db2', 'dependsOn'),
      edge('api:default/a1', 'resource:default/db3', 'dependsOn'),
    ],
    rootEntityRefs: [ROOT],
    unidirectional: true,
    maxDepth: Number.POSITIVE_INFINITY,
  };
  setDistances(ctx);
  return ctx;
}

function ids(ctx: TransformationContext) {
  return ctx.nodes.map(n => n.id).sort();
}

function connections(ctx: TransformationContext) {
  return [...new Set(ctx.edges.map(e => `${e.from} > ${e.to}`))].sort();
}

describe('createGroupByKindTransformer', () => {
  test('groups same-kind siblings and hides nodes behind collapsed groups', () => {
    const onToggleGroup = jest.fn();
    const ctx = createContext();

    createGroupByKindTransformer({
      expandedGroups: new Set(),
      onToggleGroup,
    })(ctx);

    expect(ids(ctx)).toEqual(
      [
        ROOT,
        'api:default/a1',
        'resource:default/db3',
        'user:default/u1',
        COMPONENT_GROUP,
        RESOURCE_GROUP,
      ].sort(),
    );
    expect(connections(ctx)).toEqual(
      [
        `${ROOT} > ${COMPONENT_GROUP}`,
        `${ROOT} > ${RESOURCE_GROUP}`,
        `${RESOURCE_GROUP} > ${ROOT}`,
        `${ROOT} > api:default/a1`,
        'api:default/a1 > resource:default/db3',
      ].sort(),
    );
    expect(ctx.edges.filter(e => e.to === COMPONENT_GROUP)).toHaveLength(2);
    expect(ctx.nodeDistances.get(COMPONENT_GROUP)).toBe(1);

    const group = ctx.nodes.find(n => n.id === COMPONENT_GROUP)!;
    expect(group).toMatchObject({
      focused: false,
      color: 'primary',
      entity: {
        kind: 'component',
        metadata: { name: 'component-group-1', title: 'component (2) ▸' },
      },
    });
    group.onClick!({} as any);
    expect(onToggleGroup).toHaveBeenCalledWith(COMPONENT_GROUP);
  });

  test('keeps an expanded group as a hub between its members and the root', () => {
    const ctx = createContext();

    createGroupByKindTransformer({
      expandedGroups: new Set([COMPONENT_GROUP]),
      onToggleGroup: jest.fn(),
    })(ctx);

    expect(ids(ctx)).toEqual(
      [
        ROOT,
        'component:default/c1',
        'component:default/c2',
        'resource:default/db1',
        'resource:default/db2',
        'api:default/a1',
        'resource:default/db3',
        'user:default/u1',
        COMPONENT_GROUP,
        RESOURCE_GROUP,
      ].sort(),
    );
    expect(connections(ctx)).toEqual(
      [
        `${ROOT} > ${COMPONENT_GROUP}`,
        `${COMPONENT_GROUP} > component:default/c1`,
        `${COMPONENT_GROUP} > component:default/c2`,
        'component:default/c1 > resource:default/db1',
        'component:default/c2 > resource:default/db2',
        `${ROOT} > ${RESOURCE_GROUP}`,
        `${RESOURCE_GROUP} > ${ROOT}`,
        `${ROOT} > api:default/a1`,
        'api:default/a1 > resource:default/db3',
      ].sort(),
    );
    expect(
      ctx.nodes.find(n => n.id === COMPONENT_GROUP)!.entity.metadata.title,
    ).toBe('component (2) ▾');
  });

  test('leaves the graph untouched when there is nothing to group', () => {
    const ctx = createContext();
    ctx.nodes = ctx.nodes.filter(
      n => !['component:default/c2', 'resource:default/r2'].includes(n.id),
    );
    ctx.edges = ctx.edges.filter(
      e =>
        ![e.from, e.to].some(id =>
          ['component:default/c2', 'resource:default/r2'].includes(id),
        ),
    );
    const { nodes, edges } = ctx;

    createGroupByKindTransformer({
      expandedGroups: new Set(),
      onToggleGroup: jest.fn(),
    })(ctx);

    expect(ctx.nodes).toBe(nodes);
    expect(ctx.edges).toBe(edges);
  });
});
