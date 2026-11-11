import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRoomManager } from '../net/rooms.mjs';

function makeMockClient() {
  const sent = [];
  return {
    sent,
    send(msg) { sent.push(msg); },
    close() {},
  };
}

test('Room manager handles create, join, fighter sync, full-room check, and input/state relay', () => {
  const mgr = createRoomManager();
  const host = makeMockClient();
  const guest = makeMockClient();
  const extra = makeMockClient();

  mgr.handleMessage(host, { t: 'createRoom', p1CharId: 'minnal', stageId: 'thrissur' });
  const created = host.sent.pop();
  assert.equal(created.t, 'roomCreated');
  assert.equal(created.role, 'host');
  assert.match(created.lobby.code, /^\d{4}$/);

  const code = created.lobby.code;
  mgr.handleMessage(guest, { t: 'joinRoom', code });
  const joined = guest.sent.pop();
  const peerMsg = host.sent.pop();
  assert.equal(joined.t, 'roomJoined');
  assert.equal(joined.lobby.p1CharId, 'minnal');
  assert.equal(peerMsg.t, 'peerJoined');
  assert.equal(peerMsg.lobby.hasGuest, true);

  // 3rd player is rejected cleanly
  mgr.handleMessage(extra, { t: 'joinRoom', code });
  assert.equal(extra.sent.pop().t, 'error');

  // Guest selects Nagavalli; Host receives sync
  mgr.handleMessage(guest, { t: 'lobbyUpdate', p2CharId: 'nagavalli' });
  assert.equal(host.sent.pop().lobby.p2CharId, 'nagavalli');
  assert.equal(guest.sent.pop().lobby.p2CharId, 'nagavalli');

  // Host starts match; both receive matchStart
  mgr.handleMessage(host, { t: 'startMatch', p1CharId: 'minnal', p2CharId: 'nagavalli', stageId: 'thrissur' });
  assert.equal(host.sent.pop().t, 'matchStart');
  assert.equal(guest.sent.pop().t, 'matchStart');

  // Input relays Guest -> Host and state relays Host -> Guest
  mgr.handleMessage(guest, { t: 'input', seq: 7, inp: { right: true, light: true } });
  const relayedInput = host.sent.pop();
  assert.equal(relayedInput.t, 'remoteInput');
  assert.equal(relayedInput.inp.light, true);

  mgr.handleMessage(host, { t: 'state', snap: { timer: 95 }, events: [{ type: 'hit' }] });
  const relayedState = guest.sent.pop();
  assert.equal(relayedState.t, 'stateSync');
  assert.equal(relayedState.snap.timer, 95);

  mgr.leaveCurrent(host);
  assert.equal(guest.sent.pop().t, 'roomClosed');
  assert.equal(mgr.getRoomCount(), 0);
});

test('Live HTTP/WebSocket upgrade relays room creation, join, and fight inputs over real sockets', async () => {
  const mgr = createRoomManager();
  const srv = http.createServer((req, res) => {
    res.writeHead(404);
    res.end();
  });
  srv.on('upgrade', (req, socket) => {
    mgr.handleUpgrade(req, socket);
  });

  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address();
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  function nextMsg(ws) {
    return new Promise((resolve) => {
      ws.addEventListener('message', (ev) => resolve(JSON.parse(ev.data)), { once: true });
    });
  }

  const wsHost = new WebSocket(wsUrl);
  await new Promise((r) => wsHost.addEventListener('open', r, { once: true }));

  const hostCreatedP = nextMsg(wsHost);
  wsHost.send(JSON.stringify({ t: 'createRoom', p1CharId: 'digambaran', stageId: 'alappuzha' }));
  const created = await hostCreatedP;
  assert.equal(created.t, 'roomCreated');

  const wsGuest = new WebSocket(wsUrl);
  await new Promise((r) => wsGuest.addEventListener('open', r, { once: true }));

  const guestJoinedP = nextMsg(wsGuest);
  const hostPeerP = nextMsg(wsHost);
  wsGuest.send(JSON.stringify({ t: 'joinRoom', code: created.lobby.code }));
  const [joined, peerJoined] = await Promise.all([guestJoinedP, hostPeerP]);
  assert.equal(joined.t, 'roomJoined');
  assert.equal(peerJoined.t, 'peerJoined');

  const hostInputP = nextMsg(wsHost);
  wsGuest.send(JSON.stringify({ t: 'input', seq: 1, inp: { super: true } }));
  const gotInput = await hostInputP;
  assert.equal(gotInput.t, 'remoteInput');
  assert.equal(gotInput.inp.super, true);

  wsGuest.close();
  wsHost.close();
  await new Promise((resolve) => srv.close(resolve));
});
