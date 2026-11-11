/**
 * Zero-dependency RFC 6455 WebSocket multiplayer room manager for MALLU FIGHTER II.
 * Supports Host-Authoritative LAN / Wi-Fi / Online 2-player rooms with lobby sync.
 */

import crypto from 'node:crypto';

const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function encodeWsFrame(text, opcode = 0x1) {
  const payload = Buffer.isBuffer(text) ? text : Buffer.from(String(text), 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

export function attachWsDecoder(socket, onMessage, onClose) {
  let buf = Buffer.alloc(0);
  let closed = false;

  const client = {
    send(obj) {
      if (closed || socket.destroyed) return;
      try {
        socket.write(encodeWsFrame(typeof obj === 'string' ? obj : JSON.stringify(obj), 0x1));
      } catch {
        // Ignore broken pipe during disconnect
      }
    },
    close(code = 1000) {
      if (closed || socket.destroyed) return;
      closed = true;
      clearInterval(pingTimer);
      try {
        const b = Buffer.alloc(2);
        b.writeUInt16BE(code, 0);
        socket.end(encodeWsFrame(b, 0x8));
      } catch {
        socket.destroy();
      }
    },
    isClosed: () => closed,
  };

  // Keep WebSocket alive across free cloud proxies (Render, Cloudflare, etc.)
  const pingTimer = setInterval(() => {
    if (closed || socket.destroyed) {
      clearInterval(pingTimer);
      return;
    }
    try {
      socket.write(encodeWsFrame(Buffer.alloc(0), 0x9));
    } catch {}
  }, 25000);
  pingTimer.unref?.();

  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const b0 = buf[0];
      const b1 = buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buf.length < 4) return;
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buf.length < 10) return;
        const bigLen = buf.readBigUInt64BE(2);
        if (bigLen > 1048576n) {
          socket.destroy();
          return;
        }
        payloadLen = Number(bigLen);
        offset = 10;
      }

      const maskLen = masked ? 4 : 0;
      if (buf.length < offset + maskLen + payloadLen) return;

      let payload = buf.subarray(offset + maskLen, offset + maskLen + payloadLen);
      if (masked) {
        const maskKey = buf.subarray(offset, offset + 4);
        const unmasked = Buffer.allocUnsafe(payloadLen);
        for (let i = 0; i < payloadLen; i++) {
          unmasked[i] = payload[i] ^ maskKey[i & 3];
        }
        payload = unmasked;
      }
      buf = buf.subarray(offset + maskLen + payloadLen);

      if (opcode === 0x8) {
        client.close();
        onClose();
        return;
      }
      if (opcode === 0x9) {
        try {
          socket.write(encodeWsFrame(payload, 0xa));
        } catch {}
        continue;
      }
      if (opcode === 0xa) continue;
      if (opcode === 0x1 || opcode === 0x0) {
        try {
          const msg = JSON.parse(payload.toString('utf8'));
          onMessage(msg);
        } catch {
          // Ignore malformed JSON frames
        }
      }
    }
  });

  const handleEnd = () => {
    if (closed) return;
    closed = true;
    clearInterval(pingTimer);
    onClose();
  };
  socket.on('close', handleEnd);
  socket.on('error', handleEnd);
  return client;
}

export function createRoomManager() {
  const rooms = new Map(); // code -> room
  const clientMeta = new WeakMap(); // client -> { code, role }

  function generateCode() {
    for (let i = 0; i < 40; i++) {
      const code = String(1000 + crypto.randomInt(9000));
      if (!rooms.has(code)) return code;
    }
    return String(Date.now()).slice(-4);
  }

  function publicLobbyPayload(room) {
    return {
      code: room.code,
      hasGuest: Boolean(room.guest),
      p1CharId: room.p1CharId,
      p2CharId: room.p2CharId,
      stageId: room.stageId,
      powerupsEnabled: room.powerupsEnabled,
      guestReady: room.guestReady,
      started: room.started,
    };
  }

  function broadcastRoom(room, msg) {
    room.host?.send(msg);
    room.guest?.send(msg);
  }

  function leaveCurrent(client) {
    const meta = clientMeta.get(client);
    if (!meta) return;
    clientMeta.delete(client);
    const room = rooms.get(meta.code);
    if (!room) return;

    if (meta.role === 'host') {
      room.guest?.send({ t: 'roomClosed', reason: 'Host left the room.' });
      if (room.guest) clientMeta.delete(room.guest);
      rooms.delete(room.code);
    } else if (meta.role === 'guest') {
      room.guest = null;
      room.guestReady = false;
      room.started = false;
      room.host?.send({ t: 'peerLeft', lobby: publicLobbyPayload(room) });
    }
  }

  function handleMessage(client, msg) {
    if (!msg || typeof msg !== 'object') return;
    const type = msg.t;

    if (type === 'createRoom') {
      leaveCurrent(client);
      const code = generateCode();
      const room = {
        code,
        host: client,
        guest: null,
        p1CharId: msg.p1CharId || 'maveli',
        p2CharId: msg.p2CharId || 'george',
        stageId: msg.stageId || 'alappuzha',
        powerupsEnabled: msg.powerupsEnabled !== false,
        guestReady: false,
        started: false,
      };
      rooms.set(code, room);
      clientMeta.set(client, { code, role: 'host' });
      client.send({ t: 'roomCreated', role: 'host', lobby: publicLobbyPayload(room) });
      return;
    }

    if (type === 'joinRoom') {
      const code = String(msg.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        client.send({ t: 'error', error: `Room "${code}" not found. Check the 4-digit code.` });
        return;
      }
      if (room.guest && room.guest !== client) {
        client.send({ t: 'error', error: `Room ${code} already has 2 players.` });
        return;
      }
      leaveCurrent(client);
      room.guest = client;
      room.guestReady = true;
      clientMeta.set(client, { code, role: 'guest' });
      client.send({ t: 'roomJoined', role: 'guest', lobby: publicLobbyPayload(room) });
      room.host?.send({ t: 'peerJoined', lobby: publicLobbyPayload(room) });
      return;
    }

    if (type === 'leaveRoom') {
      leaveCurrent(client);
      client.send({ t: 'leftRoom' });
      return;
    }

    const meta = clientMeta.get(client);
    if (!meta) return;
    const room = rooms.get(meta.code);
    if (!room) return;

    if (type === 'lobbyUpdate') {
      if (meta.role === 'host') {
        if (typeof msg.p1CharId === 'string') room.p1CharId = msg.p1CharId;
        if (typeof msg.stageId === 'string') room.stageId = msg.stageId;
        if (typeof msg.powerupsEnabled === 'boolean') room.powerupsEnabled = msg.powerupsEnabled;
        if (!room.guest && typeof msg.p2CharId === 'string') room.p2CharId = msg.p2CharId;
      } else {
        if (typeof msg.p2CharId === 'string') room.p2CharId = msg.p2CharId;
        if (typeof msg.guestReady === 'boolean') room.guestReady = msg.guestReady;
      }
      broadcastRoom(room, { t: 'lobbySync', lobby: publicLobbyPayload(room) });
      return;
    }

    if (type === 'startMatch' && meta.role === 'host') {
      if (!room.guest) {
        client.send({ t: 'error', error: 'Wait for Player 2 to join before starting online match.' });
        return;
      }
      if (typeof msg.p1CharId === 'string') room.p1CharId = msg.p1CharId;
      if (typeof msg.p2CharId === 'string') room.p2CharId = msg.p2CharId;
      if (typeof msg.stageId === 'string') room.stageId = msg.stageId;
      if (typeof msg.powerupsEnabled === 'boolean') room.powerupsEnabled = msg.powerupsEnabled;
      room.started = true;
      broadcastRoom(room, { t: 'matchStart', lobby: publicLobbyPayload(room) });
      return;
    }

    if (type === 'returnLobby') {
      room.started = false;
      broadcastRoom(room, { t: 'returnLobby', lobby: publicLobbyPayload(room) });
      return;
    }

    if (type === 'input' && meta.role === 'guest') {
      room.host?.send({ t: 'remoteInput', inp: msg.inp || {}, seq: msg.seq || 0 });
      return;
    }

    if (type === 'state' && meta.role === 'host') {
      room.guest?.send({ t: 'stateSync', snap: msg.snap, events: msg.events || [] });
      return;
    }

    if (type === 'rematch' && meta.role === 'host') {
      room.started = true;
      broadcastRoom(room, { t: 'matchStart', lobby: publicLobbyPayload(room) });
    }
  }

  function handleUpgrade(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return null;
    }
    const accept = crypto
      .createHash('sha1')
      .update(`${key}${WS_MAGIC_GUID}`)
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '\r\n',
      ].join('\r\n')
    );

    const client = attachWsDecoder(
      socket,
      (msg) => handleMessage(client, msg),
      () => leaveCurrent(client)
    );
    return client;
  }

  return {
    handleUpgrade,
    handleMessage,
    leaveCurrent,
    getRoomCount: () => rooms.size,
    getRoom: (code) => rooms.get(String(code)),
  };
}
