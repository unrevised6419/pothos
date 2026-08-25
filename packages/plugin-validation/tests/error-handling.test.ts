import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import * as zod from 'zod';
import '../src';

describe('Error Handling', () => {
  describe('custom validation error handling', () => {
    it('allows custom error handling with Error objects', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return new Error(
              `Custom validation error: ${failure.issues.map((i) => i.message).join(', ')}`,
            );
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              email: t.arg.string({
                validate: zod.z.string().email(),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(email: "invalid-email")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Custom validation error: Invalid email address",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });

    it('allows custom error handling with string messages', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return `String error: ${failure.issues[0]?.message || 'Unknown validation error'}`;
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              age: t.arg.int({
                validate: zod.z.number().min(18),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(age: 16)
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.[0]?.message).toBe(
        'String error: Too small: expected number to be >=18',
      );
    });

    it('provides access to args, and context in validationError handler', async () => {
      let capturedArgs: unknown;
      let capturedContext: unknown;

      const builder = new SchemaBuilder<{
        Context: { userId: string };
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (_failure, args, context) => {
            capturedArgs = args;
            capturedContext = context;
            return new Error('Validation failed with captured info');
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              email: t.arg.string({
                validate: zod.z.string().email(),
              }),
              name: t.arg.string(),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(email: "invalid", name: "John")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: { userId: 'test-user-123' },
      });

      expect(result.errors?.[0]?.message).toBe('Validation failed with captured info');
      expect(capturedArgs).toEqual({ email: 'invalid', name: 'John' });
      expect(capturedContext).toEqual({ userId: 'test-user-123' });
    });

    it('works with field-level validation using custom error handler', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return new Error(
              `Field validation failed: ${failure.issues.map((i) => i.message).join(' | ')}`,
            );
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              email: t.arg.string(),
              phone: t.arg.string(),
            },
            validate: zod.z
              .object({
                email: zod.z.string().optional(),
                phone: zod.z.string().optional(),
              })
              .refine((args) => !!args.phone || !!args.email, {
                message: 'Must provide either phone or email',
              }),
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Field validation failed: Must provide either phone or email",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });

    it('handles multiple validation issues in custom error handler', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            const messages = failure.issues.map(
              (issue) => `${issue.path?.join('.') || 'root'}: ${issue.message}`,
            );
            return new Error(`Multiple validation errors: ${messages.join('; ')}`);
          },
        },
      });

      const UserInput = builder.inputType('UserInput', {
        fields: (t) => ({
          name: t.string({
            validate: zod.z.string().min(5),
          }),
          email: t.string({
            validate: zod.z.string().email(),
          }),
        }),
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              user: t.arg({ type: UserInput }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(user: { name: "x", email: "invalid" })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Multiple validation errors: user.name: Too small: expected string to have >=5 characters; user.email: Invalid email address",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });

    it('reports issues from every sibling field of an input object', async () => {
      const builder = new SchemaBuilder<{}>({
        plugins: ['validation'],
      });

      const ExampleInput = builder.inputType('ExampleInput', {
        fields: (t) => ({
          fieldA: t.string({ validate: zod.z.string().max(5) }),
          fieldB: t.string({ validate: zod.z.string().max(5) }),
          nested: t.field({
            type: builder.inputType('NestedInput', {
              fields: (t) => ({
                fieldC: t.string({ validate: zod.z.string().max(5) }),
              }),
            }),
          }),
          fieldD: t.string({ validate: zod.z.string().max(5) }),
        }),
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              input: t.arg({ type: ExampleInput, required: true }),
              other: t.arg.string({ validate: zod.z.string().max(5) }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(
            input: {
              fieldA: "toolong"
              fieldB: "alsotoolong"
              nested: { fieldC: "toolong" }
              fieldD: "toolong"
            }
            other: "toolong"
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: input.fieldA: Too big: expected string to have <=5 characters, input.fieldB: Too big: expected string to have <=5 characters, input.nested.fieldC: Too big: expected string to have <=5 characters, input.fieldD: Too big: expected string to have <=5 characters, other: Too big: expected string to have <=5 characters",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });
  });

  describe('validation chain per field', () => {
    function createSchema() {
      const builder = new SchemaBuilder<{}>({
        plugins: ['validation'],
      });

      const Pair = builder.inputType('Pair', {
        fields: (t) => ({
          a: t.string(),
          b: t.string(),
        }),
        validate: zod.z
          .object({ a: zod.z.string(), b: zod.z.string() })
          .refine((v) => v.a === v.b, 'a must equal b'),
      });

      const Item = builder.inputType('Item', {
        fields: (t) => ({
          name: t.string(),
        }),
        validate: zod.z.object({ name: zod.z.string().max(3) }),
      });

      const Entry = builder.inputType('Entry', {
        fields: (t) => ({
          name: t.string({ validate: zod.z.string().max(3) }),
          tag: t.string(),
        }),
        validate: zod.z
          .object({ name: zod.z.string(), tag: zod.z.string() })
          .refine((v) => v.tag !== 'bad', 'bad tag'),
      });

      const AsyncItem = builder.inputType('AsyncItem', {
        fields: (t) => ({
          name: t.string(),
        }),
        validate: zod.z
          .object({ name: zod.z.string() })
          .refine(async (v) => v.name !== 'bad', 'bad item'),
      });

      builder.queryType({
        fields: (t) => ({
          pair: t.boolean({
            args: {
              pair: t.arg({
                type: Pair,
                required: true,
                validate: zod.z.object({ a: zod.z.string().max(1) }),
              }),
              other: t.arg.string({ validate: zod.z.string().max(1) }),
            },
            resolve: () => true,
          }),
          items: t.boolean({
            args: {
              items: t.arg({
                type: [Item],
                required: true,
                validate: zod.z.array(zod.z.object({ name: zod.z.string() })).max(5),
              }),
            },
            resolve: () => true,
          }),
          entries: t.boolean({
            args: {
              entries: t.arg({
                type: [Entry],
                required: true,
                validate: zod.z.array(zod.z.object({ name: zod.z.string() })).max(5),
              }),
            },
            resolve: () => true,
          }),
          asyncItems: t.boolean({
            args: {
              items: t.arg({
                type: [AsyncItem],
                required: true,
                validate: zod.z.array(zod.z.object({ name: zod.z.string() })).max(5),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      return builder.toSchema();
    }

    it('skips field schemas when the type schemas for the same field fail', async () => {
      const result = await execute({
        schema: createSchema(),
        document: gql`
          query {
            pair(pair: { a: "xx", b: "yy" }, other: "zz")
          }
        `,
        contextValue: {},
      });

      expect(result.data?.pair).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: pair: a must equal b, other: Too big: expected string to have <=1 characters",
            "path": [
              "pair",
            ],
          },
        ]
      `);
    });

    it('skips list field schemas when the type schemas for a list item fail', async () => {
      const result = await execute({
        schema: createSchema(),
        document: gql`
          query {
            items(items: [{ name: "ok" }, { name: "toolong" }])
          }
        `,
        contextValue: {},
      });

      expect(result.data?.items).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: items.1.name: Too big: expected string to have <=3 characters",
            "path": [
              "items",
            ],
          },
        ]
      `);
    });

    it('runs type schemas for list items whose nested fields passed', async () => {
      const result = await execute({
        schema: createSchema(),
        document: gql`
          query {
            entries(entries: [{ name: "toolong", tag: "ok" }, { name: "ok", tag: "bad" }])
          }
        `,
        contextValue: {},
      });

      expect(result.data?.entries).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: entries.0.name: Too big: expected string to have <=3 characters, entries.1: bad tag",
            "path": [
              "entries",
            ],
          },
        ]
      `);
    });

    it('waits for async type schemas of list items before running list field schemas', async () => {
      const schema = createSchema();

      const valid = await execute({
        schema,
        document: gql`
          query {
            asyncItems(items: [{ name: "ok" }, { name: "fine" }])
          }
        `,
        contextValue: {},
      });

      expect(valid.errors).toBeUndefined();
      expect(valid.data?.asyncItems).toBe(true);

      const invalid = await execute({
        schema,
        document: gql`
          query {
            asyncItems(items: [{ name: "ok" }, { name: "bad" }])
          }
        `,
        contextValue: {},
      });

      expect(invalid.data?.asyncItems).toBeNull();
      expect(invalid.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Validation error: items.1: bad item",
            "path": [
              "asyncItems",
            ],
          },
        ]
      `);
    });
  });

  describe('edge cases', () => {
    it('handles validationError handler that throws an error', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (_failure, _args, _context) => {
            throw new Error('Custom thrown error from handler');
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              email: t.arg.string({
                validate: zod.z.string().email(),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(email: "invalid")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.[0]?.message).toBe('Custom thrown error from handler');
    });

    it('handles async validation with custom error handler', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return new Error(`Async validation failed: ${failure.issues[0]?.message}`);
          },
        },
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              username: t.arg.string({
                validate: zod.z.string().refine(
                  async (username) => {
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    return username !== 'taken';
                  },
                  {
                    message: 'Username is already taken',
                  },
                ),
              }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(username: "taken")
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.[0]?.message).toBe(
        'Async validation failed: Username is already taken',
      );
    });

    it('works with input type validation using custom error handler', async () => {
      const builder = new SchemaBuilder<{
        Scalars: {
          ID: { Input: bigint | number | string; Output: bigint | number | string };
        };
      }>({
        plugins: ['validation'],
        validation: {
          validationError: (failure, _args, _context) => {
            return new Error(
              `Input validation failed: ${failure.issues.map((i) => i.message).join(', ')}`,
            );
          },
        },
      });

      const UserInput = builder.inputType('UserInput', {
        fields: (t) => ({
          name: t.string({
            validate: zod.z.string().min(2),
          }),
          age: t.int({
            validate: zod.z.number().min(18),
          }),
        }),
      });

      builder.queryType({
        fields: (t) => ({
          testField: t.boolean({
            args: {
              user: t.arg({ type: UserInput }),
            },
            resolve: () => true,
          }),
        }),
      });

      const schema = builder.toSchema();

      const query = gql`
        query {
          testField(user: { name: "x", age: 16 })
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data?.testField).toBeNull();
      expect(result.errors?.map((e) => e.toJSON())).toMatchInlineSnapshot(`
        [
          {
            "message": "Input validation failed: Too small: expected string to have >=2 characters, Too small: expected number to be >=18",
            "path": [
              "testField",
            ],
          },
        ]
      `);
    });
  });
});
