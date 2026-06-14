import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2EApp, loginAs } from '../utils/e2e-app';

describe('Auth e2e — sesión y confinamiento por sistema', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createE2EApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /auth/session sin cookie → { authenticated: false }', async () => {
    const res = await request(app.getHttpServer()).get('/auth/session');
    expect(res.body).toEqual({ authenticated: false });
  });

  it('usuario (origin A) es visible en A y en B (SSO)', async () => {
    const agent = await loginAs(app, 'A', ['Users']);

    const a = await agent.get('/auth/session').set('X-System', 'A');
    const b = await agent.get('/auth/session').set('X-System', 'B');

    expect(a.body.authenticated).toBe(true);
    expect(b.body.authenticated).toBe(true);
  });

  it('admin (origin A) es visible en A pero NO en B (confinamiento)', async () => {
    const agent = await loginAs(app, 'A', ['Admins']);

    const a = await agent.get('/auth/session').set('X-System', 'A');
    const b = await agent.get('/auth/session').set('X-System', 'B');

    expect(a.body.authenticated).toBe(true);
    expect(a.body.user.groups).toContain('Admins');
    expect(b.body).toEqual({ authenticated: false });
  });

  it('admin (origin B) es visible en B pero NO en A', async () => {
    const agent = await loginAs(app, 'B', ['Admins']);

    const a = await agent.get('/auth/session').set('X-System', 'A');
    const b = await agent.get('/auth/session').set('X-System', 'B');

    expect(b.body.authenticated).toBe(true);
    expect(a.body).toEqual({ authenticated: false });
  });
});
