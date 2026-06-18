import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import type { Env } from '../../config/env.schema';
import { fromItem, fromItems, toItem } from './item.util';

/**
 * Wrapper fino sobre DynamoDBClient (AWS SDK v3) con helpers genéricos tipados.
 * El cliente vive dentro del service (mismo patrón que KmsService): región desde
 * AWS_REGION en local, inyectada por el runtime en Lambda. Usa client-dynamodb +
 * util-dynamodb (no lib-dynamodb) para no depender de que el runtime lo incluya.
 */
@Injectable()
export class DynamoService {
  private readonly client: DynamoDBClient;

  constructor(config: ConfigService<Env, true>) {
    this.client = new DynamoDBClient({
      region: config.get('AWS_REGION', { infer: true }),
    });
  }

  /** GetItem por clave primaria. Devuelve undefined si no existe. */
  async get<T>(
    table: string,
    key: Record<string, unknown>,
  ): Promise<T | undefined> {
    const result = await this.client.send(
      new GetItemCommand({ TableName: table, Key: toItem(key) }),
    );
    return fromItem<T>(result.Item);
  }

  /** PutItem (crea o reemplaza). Devuelve el objeto escrito. */
  async put<T extends object>(table: string, item: T): Promise<T> {
    await this.client.send(
      new PutItemCommand({
        TableName: table,
        Item: toItem(item as Record<string, unknown>),
      }),
    );
    return item;
  }

  /** DeleteItem por clave primaria. */
  async delete(table: string, key: Record<string, unknown>): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({ TableName: table, Key: toItem(key) }),
    );
  }

  /**
   * Query por una clave de partición (tabla base o GSI). `attr` es el nombre del
   * atributo PK; `value` su valor. Se usan placeholders para evitar palabras
   * reservadas de DynamoDB en nombres de atributo.
   */
  async query<T>(
    table: string,
    attr: string,
    value: string,
    indexName?: string,
  ): Promise<T[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: table,
        IndexName: indexName,
        KeyConditionExpression: '#k = :v',
        ExpressionAttributeNames: { '#k': attr },
        ExpressionAttributeValues: {
          ':v': { S: value } as AttributeValue,
        },
      }),
    );
    return fromItems<T>(result.Items);
  }

  /** Scan completo de la tabla (uso acotado a la demo; sin paginación grande). */
  async scan<T>(table: string): Promise<T[]> {
    const items: Record<string, AttributeValue>[] = [];
    let lastKey: Record<string, AttributeValue> | undefined;
    do {
      const result = await this.client.send(
        new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }),
      );
      items.push(...(result.Items ?? []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    return fromItems<T>(items);
  }
}
