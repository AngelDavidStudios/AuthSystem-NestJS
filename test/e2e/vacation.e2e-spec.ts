import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2EApp, loginAs } from '../utils/e2e-app';
import { setupInMemoryDynamo } from '../utils/dynamo-mock';

// `loginAs` mintea una sesión con cognito:username = 'tester'. La identidad
// canónica del módulo es el username (ver VacationService.identityOf), no el sub.
const SUB = 'tester';

describe('Vacation e2e — dispatch, guards y round-trip DynamoDB', () => {
  let app: INestApplication;

  beforeEach(async () => {
    setupInMemoryDynamo();
    app = await createE2EApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('flujo admin: setBalance → getBalance → createRequest → balance refleja lo pendiente', async () => {
    const agent = await loginAs(app, 'A', ['Admins']);
    const identity = {
      userId: SUB,
      userEmail: 'tester@example.com',
      userName: 'Tester',
    };

    const setRes = await agent
      .post('/vacation')
      .set('X-System', 'A')
      .send({
        action: 'setBalance',
        ...identity,
        totalDays: 30,
        adminUserId: SUB,
      });
    expect(setRes.status).toBe(200);
    expect(setRes.body.balance.availableDays).toBe(30);

    const balRes = await agent
      .post('/vacation')
      .set('X-System', 'A')
      .send({ action: 'getBalance', userId: SUB });
    expect(balRes.status).toBe(200);
    expect(balRes.body.balance.availableDays).toBe(30);

    const createRes = await agent
      .post('/vacation')
      .set('X-System', 'A')
      .send({
        action: 'createRequest',
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        type: 'VACATION',
        ...identity,
      });
    expect(createRes.status).toBe(200);
    expect(createRes.body.request.status).toBe('PENDING');
    expect(createRes.body.request.totalDays).toBe(3);

    const balAfter = await agent
      .post('/vacation')
      .set('X-System', 'A')
      .send({ action: 'getBalance', userId: SUB });
    expect(balAfter.body.balance.pendingDays).toBe(3);
    expect(balAfter.body.balance.availableDays).toBe(27);

    const allRes = await agent
      .post('/vacation')
      .set('X-System', 'A')
      .send({ action: 'getAllRequests' });
    expect(allRes.status).toBe(200);
    expect(allRes.body.requests).toHaveLength(1);
  });

  it('rechaza sin sesión (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/vacation')
      .send({ action: 'getAllRequests' });
    expect(res.status).toBe(401);
  });

  it('un usuario normal no puede usar acciones de admin (403)', async () => {
    const agent = await loginAs(app, 'A', ['Users']);
    const res = await agent
      .post('/vacation')
      .set('X-System', 'A')
      .send({ action: 'getAllRequests' });
    expect(res.status).toBe(403);
  });

  it('rechaza una acción desconocida vía ValidationPipe (400)', async () => {
    const agent = await loginAs(app, 'A', ['Admins']);
    const res = await agent
      .post('/vacation')
      .set('X-System', 'A')
      .send({ action: 'noExiste' });
    expect(res.status).toBe(400);
  });
});
