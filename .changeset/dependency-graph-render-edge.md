---
'@backstage/core-components': patch
---

The `renderEdge` function of `DependencyGraph` now receives the `nodes` of the graph as laid out, keyed by id, and a `renderDefault` function that renders the edge the way the graph would without a custom renderer. This allows an implementation to customize some edges and fall back to the default rendering for the rest. Custom edges are now also keyed, which removes a React warning about missing keys.
