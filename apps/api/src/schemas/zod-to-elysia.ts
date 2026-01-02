import { t, type TSchema } from "elysia";
import {
  type ZodTypeAny,
  type ZodObject,
  type ZodString,
  type ZodNumber,
  type ZodBoolean,
  type ZodArray,
  type ZodEnum,
  type ZodOptional,
  type ZodNullable,
  type ZodUnion,
  type ZodLiteral,
  type ZodDate,
  ZodFirstPartyTypeKind,
} from "zod";

/**
 * Converts a Zod schema to an Elysia TypeBox schema.
 *
 * Supports common Zod types used in the codebase:
 * - z.string() (with optional min/max/uuid/regex constraints)
 * - z.number()
 * - z.boolean()
 * - z.date()
 * - z.array()
 * - z.object()
 * - z.enum()
 * - z.literal()
 * - z.optional()
 * - z.nullable()
 * - z.union()
 */
export function zodToElysia<T extends ZodTypeAny>(schema: T): TSchema {
  const def = schema._def;
  const typeName = def.typeName as ZodFirstPartyTypeKind;

  switch (typeName) {
    case ZodFirstPartyTypeKind.ZodString: {
      const stringSchema = schema as unknown as ZodString;
      const checks = stringSchema._def.checks || [];

      let result = t.String();

      // Apply constraints from checks
      for (const check of checks) {
        if (check.kind === "min") {
          result = t.String({ minLength: check.value });
        } else if (check.kind === "max") {
          result = t.String({ maxLength: check.value });
        } else if (check.kind === "uuid") {
          result = t.String({ format: "uuid" });
        }
        // Note: regex and refine constraints are not directly transferable to TypeBox
        // They will be validated by Zod at runtime
      }

      return result;
    }

    case ZodFirstPartyTypeKind.ZodNumber: {
      const numberSchema = schema as unknown as ZodNumber;
      const checks = numberSchema._def.checks || [];

      let opts: Record<string, number> = {};
      for (const check of checks) {
        if (check.kind === "min") {
          opts.minimum = check.value;
        } else if (check.kind === "max") {
          opts.maximum = check.value;
        } else if (check.kind === "int") {
          // TypeBox doesn't have a direct integer type, using Number
        }
      }

      return Object.keys(opts).length > 0 ? t.Number(opts) : t.Number();
    }

    case ZodFirstPartyTypeKind.ZodBoolean:
      return t.Boolean();

    case ZodFirstPartyTypeKind.ZodDate:
      return t.Date();

    case ZodFirstPartyTypeKind.ZodArray: {
      const arraySchema = schema as unknown as ZodArray<ZodTypeAny>;
      const elementType = zodToElysia(arraySchema._def.type);
      return t.Array(elementType);
    }

    case ZodFirstPartyTypeKind.ZodObject: {
      const objectSchema = schema as unknown as ZodObject<Record<string, ZodTypeAny>>;
      const shape = objectSchema._def.shape();
      const properties: Record<string, TSchema> = {};

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToElysia(value as ZodTypeAny);
      }

      return t.Object(properties);
    }

    case ZodFirstPartyTypeKind.ZodEnum: {
      const enumSchema = schema as unknown as ZodEnum<[string, ...string[]]>;
      const values = enumSchema._def.values as string[];

      // Convert to Union of Literals for Elysia
      if (values.length === 1) {
        return t.Literal(values[0]);
      }
      return t.Union(values.map((v) => t.Literal(v)));
    }

    case ZodFirstPartyTypeKind.ZodLiteral: {
      const literalSchema = schema as unknown as ZodLiteral<unknown>;
      return t.Literal(literalSchema._def.value as string | number | boolean);
    }

    case ZodFirstPartyTypeKind.ZodOptional: {
      const optionalSchema = schema as unknown as ZodOptional<ZodTypeAny>;
      const innerType = zodToElysia(optionalSchema._def.innerType);
      return t.Optional(innerType);
    }

    case ZodFirstPartyTypeKind.ZodNullable: {
      const nullableSchema = schema as unknown as ZodNullable<ZodTypeAny>;
      const innerType = zodToElysia(nullableSchema._def.innerType);
      return t.Union([innerType, t.Null()]);
    }

    case ZodFirstPartyTypeKind.ZodUnion: {
      const unionSchema = schema as unknown as ZodUnion<[ZodTypeAny, ...ZodTypeAny[]]>;
      const options = unionSchema._def.options as ZodTypeAny[];
      return t.Union(options.map((opt) => zodToElysia(opt)));
    }

    case ZodFirstPartyTypeKind.ZodEffects: {
      // Effects (like refine) - convert the inner schema
      // The refinement will be applied by Zod at runtime
      const innerSchema = def.schema as ZodTypeAny;
      return zodToElysia(innerSchema);
    }

    default:
      // Fallback for unknown types
      console.warn(
        `Unsupported Zod type: ${typeName}, falling back to t.Any()`
      );
      return t.Any();
  }
}

/**
 * Helper to create an Elysia schema from a Zod schema and return both.
 * Useful when you want to use Zod for runtime validation and Elysia for OpenAPI.
 */
export function z2e<T extends ZodTypeAny>(zodSchema: T) {
  return zodToElysia(zodSchema);
}
