const nodemailer = require('nodemailer');
require('dotenv').config();

// 1. Configuramos el "cartero" con el puerto seguro de Gmail (465)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Usa SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Agregamos un chismoso para la consola de Render
console.log('--- TEST DE VARIABLES EN RENDER ---');
console.log('Usuario de Email:', process.env.EMAIL_USER || '¡ESTÁ VACÍO!');
console.log('¿Tiene contraseña cargada?:', process.env.EMAIL_PASS ? 'SÍ' : 'NO');
console.log('-----------------------------------');

// 2. Armamos la función que inyecta los datos en el diseño HTML
const enviarMailConfirmacion = async (emailCliente, nombreCliente, fechaHora, nombreNegocio) => {
    try {
        // Este HTML imita la estructura de la foto que mandaste
        const plantillaHTML = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #5b8c73; color: white; padding: 20px; text-align: center;">
                    <h2>${nombreNegocio}</h2>
                </div>
                
                <div style="padding: 20px; text-align: center;">
                    <h3 style="color: #333;">${nombreCliente}, ¡Confirma tu asistencia en ${nombreNegocio}!</h3>
                    
                    <p style="color: #666; font-size: 14px;">Cita #183230599 <span style="background-color: #8b5cf6; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">Agendada</span></p>
                    
                    <a href="#" style="display: inline-block; background-color: #e6f4ea; color: #1e8e3e; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; border: 1px solid #1e8e3e;">
                        ✔️ Confirmar cita
                    </a>

                    <div style="text-align: left; background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p>📅 <strong>Fecha y Hora:</strong> ${fechaHora}</p>
                        <p>📍 <strong>Lugar:</strong> Dirección del local 123</p>
                    </div>

                    <a href="#" style="display: block; color: #f59e0b; text-decoration: none; border: 1px solid #f59e0b; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
                        🔄 Modificar cita
                    </a>
                    <a href="#" style="display: block; color: #ef4444; text-decoration: none; border: 1px solid #ef4444; padding: 10px; border-radius: 5px;">
                        ❌ Cancelar cita
                    </a>
                </div>
            </div>
        `;

        // 3. Enviamos el mail
        const info = await transporter.sendMail({
            from: `"Turnero ${nombreNegocio}" <tu_correo_del_proyecto@gmail.com>`,
            to: emailCliente,
            subject: `Confirma tu turno en ${nombreNegocio} 📅`,
            html: plantillaHTML
        });

        console.log(`📧 Mail enviado correctamente a ${emailCliente}`);
    } catch (error) {
        console.error('Error enviando el mail:', error);
    }
};

const enviarMailCancelacion = (emailCliente, nombreCliente, fechaHora, nombreNegocio) => {
    const mailOptions = {
        from: 'Tu Sistema de Turnos',
        to: emailCliente,
        subject: `Cancelación de turno - ${nombreNegocio}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #6c757d; color: white; padding: 20px; text-align: center;">
                    <h1>Turno Cancelado</h1>
                </div>
                <div style="padding: 20px; color: #333;">
                    <p>Hola <strong>${nombreCliente}</strong>,</p>
                    <p>Te informamos que tu turno en <strong>${nombreNegocio}</strong> ha sido cancelado exitosamente.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p><strong>Detalles del turno cancelado:</strong></p>
                    <p>📅 Fecha y Hora: ${fechaHora}</p>
                    <p>📍 Lugar: ${nombreNegocio}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p>Si esto fue un error o querés reprogramar, podés volver a sacar un turno desde nuestra web.</p>
                    <p>¡Saludos!</p>
                </div>
            </div>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error enviando mail de cancelación:', error);
        } else {
            console.log('📧 Mail de cancelación enviado a: ' + emailCliente);
        }
    });
};

// No te olvides de exportarla también
module.exports = { enviarMailConfirmacion, enviarMailCancelacion };