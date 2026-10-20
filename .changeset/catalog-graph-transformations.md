---
'@backstage/plugin-catalog-graph': patch
---

Added a `transformations` prop to `EntityRelationsGraph`, `EntityCatalogGraphCard` and `CatalogGraphPage` for running custom graph transformations after the built-in ones. The `GraphTransformer` type is now exported.
