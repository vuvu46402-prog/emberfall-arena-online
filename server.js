// Emberfall Arena room server (Node.js + ws)
// Install: npm install
// Run: npm start
const WebSocket = require('ws');
const crypto = require('crypto');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
const rooms = new Map();
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const send = (ws, obj) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
function leave(ws) {
  const room = ws.room && rooms.get(ws.room);
  if (!room) return;
  room.players = room.players.filter(p => p !== ws);
  for (const p of room.players) send(p, { type: 'peer-left', room: ws.room });
  if (!room.players.length) rooms.delete(ws.room);
  ws.room = null;
}
wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return send(ws,{type:'error',message:'Invalid JSON'}); }
    if (msg.type === 'create-room') {
      leave(ws); let roomCode; do { roomCode = code(); } while (rooms.has(roomCode));
      rooms.set(roomCode,{players:[ws]}); ws.room=roomCode; ws.role=0;
      return send(ws,{type:'room-created',room:roomCode});
    }
    if (msg.type === 'join-room') {
      const roomCode=String(msg.room||'').toUpperCase(), room=rooms.get(roomCode);
      if (!room) return send(ws,{type:'error',message:'Room not found. Check the code.'});
      if (room.players.length >= 2) return send(ws,{type:'error',message:'Room is full.'});
      leave(ws); room.players.push(ws); ws.room=roomCode; ws.role=1;
      send(ws,{type:'room-joined',room:roomCode});
      for (const p of room.players) send(p,{type:'player-joined',room:roomCode});
      for (const p of room.players) send(p,{type:'room-ready',room:roomCode});
      return;
    }
    if (msg.type === 'peer-event') {
      const room=ws.room && rooms.get(ws.room);
      if (!room || room.players.length !== 2) return send(ws,{type:'error',message:'You need two players in the room first.'});
      for (const p of room.players) if (p !== ws) send(p,{type:'peer-event',payload:msg.payload});
    }
  });
  ws.on('close',()=>leave(ws));
});
console.log(`Emberfall room server listening on ${PORT}`);
