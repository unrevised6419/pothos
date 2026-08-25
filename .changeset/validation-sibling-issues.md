---
'@pothos/plugin-validation': patch
---

Report validation issues from every field of an input object instead of stopping after the first field that fails. When the type-level schemas for a field fail, the field-level schemas for that field are no longer run against the failed result, and list-level schemas now wait for async type-level schemas of list items to complete.
