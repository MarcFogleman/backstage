---
'@backstage/plugin-catalog-graph': patch
---

The `renderEdge` prop of `EntityRelationsGraph` now receives the nodes of the graph as laid out, typed as `EntityNode`, along with a `renderDefault` function for falling back to the default edge rendering.
