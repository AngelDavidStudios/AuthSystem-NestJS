import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';

// Opciones compartidas para marshall: ignoramos `undefined` (DynamoDB no acepta
// atributos undefined) y convertimos clases planas. unmarshall sin números BigInt
// para que `N` salga como `number` de JS (suficiente para días/niveles/años).
const MARSHALL_OPTS = {
  removeUndefinedValues: true,
  convertClassInstanceToMap: true,
} as const;

/** Convierte un objeto JS a un Item de DynamoDB (mapa de AttributeValue). */
export function toItem(
  obj: Record<string, unknown>,
): Record<string, AttributeValue> {
  return marshall(obj, MARSHALL_OPTS);
}

/** Convierte un Item de DynamoDB de vuelta a un objeto JS tipado. */
export function fromItem<T>(
  item: Record<string, AttributeValue> | undefined,
): T | undefined {
  if (!item) return undefined;
  return unmarshall(item) as T;
}

/** Convierte una lista de Items de DynamoDB a objetos JS tipados. */
export function fromItems<T>(
  items: Record<string, AttributeValue>[] | undefined,
): T[] {
  return (items ?? []).map((i) => unmarshall(i) as T);
}
