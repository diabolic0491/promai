import {
  systemContractTemplateVariables,
} from "../constants/contracts";

export function getCustomTemplateVariables(
  variables: string[],
): string[] {
  return variables.filter(
    (variable) =>
      !systemContractTemplateVariables.has(variable),
  );
}

export function getNestedValue(
  source: Record<string, unknown>,
  path: string,
): string {
  let current: unknown = source;

  for (const segment of path.split(".")) {
    if (
      !current ||
      typeof current !== "object" ||
      !(segment in current)
    ) {
      return "";
    }

    current = (current as Record<string, unknown>)[
      segment
    ];
  }

  if (
    current === null ||
    current === undefined ||
    typeof current === "object"
  ) {
    return "";
  }

  return String(current);
}

export function buildNestedFormData(
  values: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  Object.entries(values).forEach(([path, rawValue]) => {
    const value = rawValue.trim();

    if (!value) {
      return;
    }

    const segments = path.split(".");
    let cursor = result;

    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        cursor[segment] = value;
        return;
      }

      const existing = cursor[segment];

      if (
        !existing ||
        typeof existing !== "object" ||
        Array.isArray(existing)
      ) {
        cursor[segment] = {};
      }

      cursor = cursor[segment] as Record<
        string,
        unknown
      >;
    });
  });

  return result;
}

export function flattenFormData(
  value: Record<string, unknown>,
  prefix = "",
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  Object.entries(value).forEach(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      nested &&
      typeof nested === "object" &&
      !Array.isArray(nested)
    ) {
      entries.push(
        ...flattenFormData(
          nested as Record<string, unknown>,
          path,
        ),
      );
      return;
    }

    if (nested !== null && nested !== undefined) {
      entries.push([path, String(nested)]);
    }
  });

  return entries;
}
