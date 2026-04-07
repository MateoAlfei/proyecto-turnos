const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Inicializamos el cliente de WhatsApp con "LocalAuth" para que guarde la sesión
// Inicializamos el cliente de WhatsApp con la solución al crash
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    // 👇 ESTA ES LA LÍNEA MÁGICA QUE ARREGLA EL ERROR 👇
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

// Cuando genere el QR, lo mostramos en la consola
client.on('qr', (qr) => {
    console.log('📱 Por favor, escaneá este código QR con el celular del negocio:');
    qrcode.generate(qr, { small: true });
});

// Cuando se conecte exitosamente
client.on('ready', () => {
    console.log('✅ ¡Bot de WhatsApp conectado y listo para mandar mensajes!');
});

// Arrancamos el cliente
client.initialize();

// Creamos una función que vamos a exportar para usarla en index.js
const enviarNotificacion = async (numero, mensaje) => {
    try {
        // WhatsApp requiere que el número termine en "@c.us"
        // Ej: "5493510000000@c.us"
        const chatId = `${numero}@c.us`;
        await client.sendMessage(chatId, mensaje);
        console.log(`Mensaje enviado correctamente a ${numero}`);
    } catch (error) {
        console.error(`Error enviando mensaje a ${numero}:`, error);
    }
};

module.exports = { enviarNotificacion };