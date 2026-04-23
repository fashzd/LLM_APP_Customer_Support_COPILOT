function joinPath(base, segment) {
  return base ? `${base}.${segment}` : segment;
}

function validateArrayItems(schema, value, path, errors) {
  if (!schema.items) {
    return;
  }

  value.forEach((item, index) => {
    validateAgainstSchema(schema.items, item, `${path}[${index}]`, errors);
  });
}

export function validateAgainstSchema(schema, value, path = "", errors = []) {
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path || "value"} must be one of: ${schema.enum.join(", ")}`);
    return errors;
  }

  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${path || "value"} must be an object`);
      return errors;
    }

    const required = schema.required || [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${joinPath(path, key)} is required`);
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) {
          errors.push(`${joinPath(path, key)} is not allowed`);
        }
      }
    }

    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (key in value) {
          validateAgainstSchema(propertySchema, value[key], joinPath(path, key), errors);
        }
      }
    }

    return errors;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path || "value"} must be an array`);
      return errors;
    }

    validateArrayItems(schema, value, path || "value", errors);
    return errors;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      errors.push(`${path || "value"} must be a string`);
      return errors;
    }

    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${path || "value"} must be at least ${schema.minLength} characters`);
    }

    return errors;
  }

  return errors;
}

export function isValidAgainstSchema(schema, value) {
  const errors = validateAgainstSchema(schema, value);

  return {
    valid: errors.length === 0,
    errors
  };
}

export function toOpenAISchema(schema) {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    return schema;
  }

  const allowedKeys = new Set([
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "enum"
  ]);

  const next = {};

  for (const [key, value] of Object.entries(schema)) {
    if (!allowedKeys.has(key)) {
      continue;
    }

    if (key === "properties") {
      const properties = {};
      for (const [propertyName, propertySchema] of Object.entries(value)) {
        properties[propertyName] = toOpenAISchema(propertySchema);
      }
      next.properties = properties;
      continue;
    }

    if (key === "items") {
      next.items = toOpenAISchema(value);
      continue;
    }

    next[key] = value;
  }

  return next;
}
