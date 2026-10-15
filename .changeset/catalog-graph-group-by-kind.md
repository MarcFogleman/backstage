---
'@backstage/plugin-catalog-graph': patch
---

Added an opt-in `groupByKind` option to `EntityRelationsGraph`, `EntityCatalogGraphCard` and `CatalogGraphPage`, also available in the extension configuration of the relations card and the graph page. When enabled, entities of the same kind that are related to the same entities are shown as a single node with a count, for example `Resource (120)`, which can be clicked to expand or collapse it. This keeps the graph readable for entities with a large number of relations, such as a group that owns hundreds of resources. The graph page gets a "Group by kind" filter switch that is persisted in the URL like the other filters.
