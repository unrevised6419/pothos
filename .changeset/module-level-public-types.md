---
'@pothos/core': major
'@pothos/plugin-zod': major
'@pothos/plugin-add-graphql': major
'@pothos/plugin-complexity': major
'@pothos/plugin-dataloader': major
'@pothos/plugin-directives': major
'@pothos/plugin-drizzle': major
'@pothos/plugin-errors': major
'@pothos/plugin-example': major
'@pothos/plugin-federation': major
'@pothos/plugin-grafast': major
'@pothos/plugin-mocks': major
'@pothos/plugin-prisma': major
'@pothos/plugin-prisma-utils': major
'@pothos/plugin-relay': major
'@pothos/plugin-scope-auth': major
'@pothos/plugin-simple-objects': major
'@pothos/plugin-smart-subscriptions': major
'@pothos/plugin-sub-graph': major
'@pothos/plugin-tracing': major
'@pothos/plugin-validation': major
'@pothos/plugin-with-input': major
---

Move Pothos' public types out of the ambient `PothosSchemaTypes` global and into module exports.

The interfaces that make up the public API were declared inside `declare global { namespace PothosSchemaTypes }`. That made them unnameable from a declaration file that has to stand on its own: a library wrapping the builder emitted `PothosSchemaTypes.SchemaBuilder<...>` with nothing anchoring the global, and the output failed to type-check with `TS2503: Cannot find namespace 'PothosSchemaTypes'` unless `skipLibCheck` was on. They are now plain exports of `@pothos/core/types`, re-exported as a namespace so the `PothosSchemaTypes.Foo` spelling still works, and an emitted declaration now references them as `import("@pothos/core/types").SchemaBuilder<...>`, which anchors itself.

This is a breaking change for anyone who augments Pothos' types. Plugins and applications that extend the builder must replace

```ts
declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      myPlugin: MyPlugin<Types>;
    }
  }
}
```

with

```ts
declare module '@pothos/core/types' {
  export interface Plugins<Types extends SchemaTypes> {
    myPlugin: MyPlugin<Types>;
  }
}
```

Inside a `declare module` block, sibling types are not in scope by bare name the way namespace members were. Import the `PothosSchemaTypes` namespace from `@pothos/core` and qualify them (`PothosSchemaTypes.ObjectRef`, `PothosSchemaTypes.ObjectFieldOptions`). Take care with `ObjectTypeOptions`, `InterfaceTypeOptions` and `EnumTypeOptions`: top-level exports with those names exist but have different signatures, so importing them by bare name resolves to a different type instead of failing.

An augmentation left targeting the old global does not error where it is written. It silently stops applying and surfaces later as an unrelated-looking assignability or constraint error, so audit test and example files as well as `src`.
