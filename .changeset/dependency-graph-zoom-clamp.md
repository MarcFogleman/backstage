---
'@backstage/core-components': patch
---

Fixed an issue where `DependencyGraph` could end up partly or fully out of view when its contents changed size while zoomed in, for example when nodes were added or removed. The zoom transform is now clamped again whenever the size of the graph changes.
