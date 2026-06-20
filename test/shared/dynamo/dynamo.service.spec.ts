import { ConfigService } from '@nestjs/config';
import { DynamoService } from '../../../src/shared/dynamo/dynamo.service';
import type { Env } from '../../../src/config/env.schema';
import { setupInMemoryDynamo } from '../../utils/dynamo-mock';

// Config mínima: DynamoService solo lee AWS_REGION en el constructor.
const config = {
  get: (key: keyof Env) => (key === 'AWS_REGION' ? 'us-east-1' : undefined),
} as unknown as ConfigService<Env, true>;

interface Row {
  id: string;
  name: string;
  group?: string;
}

describe('DynamoService (wrapper genérico sobre DynamoDBClient)', () => {
  let dynamo: DynamoService;
  let store: ReturnType<typeof setupInMemoryDynamo>['store'];

  beforeEach(() => {
    ({ store } = setupInMemoryDynamo());
    dynamo = new DynamoService(config);
  });

  it('put + get hace round-trip por util-dynamodb (marshall/unmarshall)', async () => {
    const written = await dynamo.put<Row>('tbl', { id: 'a1', name: 'Ada' });
    expect(written).toEqual({ id: 'a1', name: 'Ada' });

    const read = await dynamo.get<Row>('tbl', { id: 'a1' });
    expect(read).toEqual({ id: 'a1', name: 'Ada' });
  });

  it('get devuelve undefined cuando la clave no existe', async () => {
    expect(await dynamo.get<Row>('tbl', { id: 'missing' })).toBeUndefined();
  });

  it('put con la misma clave reemplaza (no duplica)', async () => {
    await dynamo.put<Row>('tbl', { id: 'a1', name: 'Ada' });
    await dynamo.put<Row>('tbl', { id: 'a1', name: 'Grace' });
    expect(await dynamo.get<Row>('tbl', { id: 'a1' })).toEqual({
      id: 'a1',
      name: 'Grace',
    });
    expect(store.get('tbl')).toHaveLength(1);
  });

  it('delete elimina por clave primaria', async () => {
    await dynamo.put<Row>('tbl', { id: 'a1', name: 'Ada' });
    await dynamo.delete('tbl', { id: 'a1' });
    expect(await dynamo.get<Row>('tbl', { id: 'a1' })).toBeUndefined();
  });

  it('query filtra por el atributo de la clave de partición', async () => {
    await dynamo.put<Row>('tbl', { id: 'a1', name: 'Ada', group: 'x' });
    await dynamo.put<Row>('tbl', { id: 'a2', name: 'Bob', group: 'x' });
    await dynamo.put<Row>('tbl', { id: 'a3', name: 'Cid', group: 'y' });

    const xs = await dynamo.query<Row>('tbl', 'group', 'x', 'byGroup');
    expect(xs.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
  });

  it('scan devuelve todos los items de la tabla', async () => {
    await dynamo.put<Row>('tbl', { id: 'a1', name: 'Ada' });
    await dynamo.put<Row>('tbl', { id: 'a2', name: 'Bob' });
    const all = await dynamo.scan<Row>('tbl');
    expect(all.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
  });

  it('scan de una tabla vacía devuelve []', async () => {
    expect(await dynamo.scan<Row>('empty')).toEqual([]);
  });
});
