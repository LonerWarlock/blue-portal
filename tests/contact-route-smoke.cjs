const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

async function main() {
  const messages = [];
  const smtp = net.createServer(socket => {
    socket.setEncoding('utf8');
    socket.write('220 localhost ESMTP\r\n');
    let buffer = '';
    let dataMode = false;
    let message = '';

    socket.on('data', chunk => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (dataMode) {
          if (line === '.') {
            messages.push(message);
            message = '';
            dataMode = false;
            socket.write('250 Message accepted\r\n');
          } else {
            message += line + '\r\n';
          }
        } else if (/^EHLO /i.test(line)) {
          socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n');
        } else if (/^AUTH PLAIN /i.test(line)) {
          socket.write('235 Authentication successful\r\n');
        } else if (/^DATA$/i.test(line)) {
          dataMode = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (/^QUIT$/i.test(line)) {
          socket.end('221 Bye\r\n');
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });
  await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));

  const port = 35891;
  const env = {
    ...process.env,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.address().port),
    SMTP_USER: 'sender@example.test',
    SMTP_PASS: 'test-only',
    CONTACT_EMAIL_TO: 'recipient@example.test',
    RESEND_API_KEY: 'ignored-when-smtp-is-configured',
    RESEND_FROM_EMAIL: 'unused@example.test',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
    TURNSTILE_SECRET_KEY: '',
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: ''
  };
  const next = spawn(process.execPath, [
    path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next'),
    'dev', '-p', String(port)
  ], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
  let nextOutput = '';
  next.stdout.on('data', chunk => { nextOutput += chunk.toString(); });
  next.stderr.on('data', chunk => { nextOutput += chunk.toString(); });

  try {
    const url = `http://127.0.0.1:${port}/api/contact`;
    let ready = false;
    for (let i = 0; i < 80; i += 1) {
      if (next.exitCode !== null) throw new Error('Next exited: ' + nextOutput.slice(-1500));
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
          signal: AbortSignal.timeout(3_000)
        });
        assert.equal(response.status, 400);
        ready = true;
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    if (!ready) throw new Error('Next did not become ready: ' + nextOutput.slice(-1500));

    const payload = {
      name: 'Contact Smoke',
      email: 'reporter@example.test',
      message: 'A report containing <script>unsafe</script>'
    };
    const trapped = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, website: 'bot.example' })
    });
    assert.equal(trapped.status, 400);
    assert.equal(messages.length, 0);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(response.status, 200, await response.text());
    assert.equal(messages.length, 1);
    assert.match(messages[0], /reporter@example\.test/);
    assert.match(messages[0], /&lt;script&gt;unsafe/);
    assert.doesNotMatch(messages[0], /<script>unsafe/);
    console.log('Contact route accepted one message through local SMTP; invalid and trapped requests sent none.');
  } finally {
    next.kill();
    smtp.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
