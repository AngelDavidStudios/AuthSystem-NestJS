import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';

type Item = Record<string, unknown>;

/**
 * Fake en memoria de DynamoDB para e2e: implementa Put/Get/Delete/Query/Scan
 * sobre un Map por tabla. Trabaja con Items ya "marshalled" (mapas AttributeValue),
 * así que el round-trip con util-dynamodb del servicio es transparente.
 *
 * Heurística de clave primaria (suficiente para el esquema del módulo): `id` si
 * existe, si no `userId` (balances). Query resuelve el patrón `#k = :v` que emite
 * DynamoService.query (tabla base o GSI).
 */
export function setupInMemoryDynamo() {
  const ddb = mockClient(DynamoDBClient);
  const store = new Map<string, Item[]>();

  const tableOf = (name?: string): Item[] => {
    const key = name ?? '';
    if (!store.has(key)) store.set(key, []);
    return store.get(key)!;
  };
  const pkAttrs = (item: Item): string[] =>
    item.id !== undefined ? ['id'] : ['userId'];
  const matches = (item: Item, key: Item, attrs: string[]): boolean =>
    attrs.every((a) => JSON.stringify(item[a]) === JSON.stringify(key[a]));

  ddb.on(PutItemCommand).callsFake((input) => {
    const items = tableOf(input.TableName);
    const attrs = pkAttrs(input.Item);
    const idx = items.findIndex((it) => matches(it, input.Item, attrs));
    if (idx >= 0) items[idx] = input.Item;
    else items.push(input.Item);
    return {};
  });

  ddb.on(GetItemCommand).callsFake((input) => {
    const items = tableOf(input.TableName);
    const attrs = Object.keys(input.Key);
    const found = items.find((it) => matches(it, input.Key, attrs));
    return found ? { Item: found } : {};
  });

  ddb.on(DeleteItemCommand).callsFake((input) => {
    const items = tableOf(input.TableName);
    const attrs = Object.keys(input.Key);
    const idx = items.findIndex((it) => matches(it, input.Key, attrs));
    if (idx >= 0) items.splice(idx, 1);
    return {};
  });

  ddb.on(QueryCommand).callsFake((input) => {
    const items = tableOf(input.TableName);
    const attr = input.ExpressionAttributeNames!['#k'];
    const value = input.ExpressionAttributeValues![':v'];
    const matched = items.filter(
      (it) => JSON.stringify(it[attr]) === JSON.stringify(value),
    );
    return { Items: matched };
  });

  ddb.on(ScanCommand).callsFake((input) => ({
    Items: [...tableOf(input.TableName)],
  }));

  return { ddb, store };
}
