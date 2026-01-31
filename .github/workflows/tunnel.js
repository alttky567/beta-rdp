const net = require('net');

// Lấy thông tin từ biến môi trường (Environment Variables)
const SERVICE_ID = process.env.TUNNEL_SERVICE || 'rdp';
const LOCAL_PORT = parseInt(process.env.TUNNEL_LOCAL_PORT) || 3389;
const REMOTE_HOST = process.env.TUNNEL_REMOTE_HOST; // Sẽ lấy từ GitHub Secret
const REMOTE_PORT = parseInt(process.env.TUNNEL_REMOTE_PORT); // Sẽ lấy từ GitHub Secret

if (!REMOTE_HOST || !REMOTE_PORT) {
  console.error("Thiếu cấu hình REMOTE_HOST hoặc REMOTE_PORT trong ENV!");
  process.exit(1);
}

let controlSocket = null;

function createControlConnection() {
  console.log(`Đang thiết lập tunnel cho: ${SERVICE_ID}`);
  
  controlSocket = net.connect({
    host: REMOTE_HOST,
    port: REMOTE_PORT
  }, () => {
    console.log('Kết nối điều khiển thành công');
    controlSocket.write(`TUNNEL|${SERVICE_ID}\n`);
  });
  
  controlSocket.once('data', (data) => {
    if (data.toString().startsWith('OK')) {
      console.log(`✅ Tunnel Active: localhost:${LOCAL_PORT} <-> ${REMOTE_HOST}:${REMOTE_PORT}`);
      listenForNewConnections();
    }
  });
  
  controlSocket.on('error', (err) => {
    console.error('Lỗi kết nối:', err.message);
    setTimeout(createControlConnection, 5000);
  });
  
  controlSocket.on('close', () => {
    console.log('Mất kết nối, đang thử lại...');
    setTimeout(createControlConnection, 5000);
  });
}

function listenForNewConnections() {
  let buffer = Buffer.alloc(0);
  controlSocket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).toString('utf8');
      buffer = buffer.slice(idx + 1);
      const [cmd, connId] = line.split('|');
      if (cmd === 'NEW') handleNewConnection(connId);
    }
  });
}

function handleNewConnection(connId) {
  const localSocket = net.connect({ host: '127.0.0.1', port: LOCAL_PORT }, () => {
    const dataSocket = net.connect({ host: REMOTE_HOST, port: REMOTE_PORT }, () => {
      dataSocket.write(`DATA|${SERVICE_ID}|${connId}\n`);
      localSocket.pipe(dataSocket);
      dataSocket.pipe(localSocket);
    });
    dataSocket.on('error', () => localSocket.destroy());
  });
  localSocket.on('error', () => {});
}

createControlConnection();
