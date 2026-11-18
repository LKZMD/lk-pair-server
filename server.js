const express = require('express');
const cors = require('cors');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());

app.get('/pair', async (req, res) => {
    const number = (req.query.number || '').replace(/[^0-9]/g, '');
    if (!number || number.length < 8) return res.status(400).json({ error: 'Invalid phone number' });

    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session_' + number);
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['Ubuntu', 'Chrome', '20.0.04']
        });

        sock.ev.on('creds.update', saveCreds);

        if (!sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(number);
                    res.json({ code });
                } catch (e) {
                    res.status(500).json({ error: e.message });
                }
            }, 2000);
        }

        sock.ev.on('connection.update', async ({ connection }) => {
            if (connection === 'open') {
                const sessionB64 = Buffer.from(JSON.stringify(state.creds)).toString('base64');
                await sock.sendMessage(sock.user.id, { text: 'LKZ~' + sessionB64 });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(process.env.PORT || 3000, () => console.log('LKZ Baileys Pairing Server running on port 3000'));
