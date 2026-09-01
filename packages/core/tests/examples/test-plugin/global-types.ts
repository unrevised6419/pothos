import type { FieldNullability, InputFieldMap, SchemaTypes, TypeParam } from '../../../src';
import type { PothosTestPlugin } from './plugin';

declare module '../../../src/types/global' {
  export interface Plugins<Types extends SchemaTypes> {
    test: PothosTestPlugin<Types>;
  }

  export interface InterfaceFieldOptions<
    Types extends SchemaTypes,
    ParentShape,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>,
    Args extends InputFieldMap,
    ResolveReturnShape,
  > {
    exampleRequiredOptionFromPlugin: boolean;
  }
}
