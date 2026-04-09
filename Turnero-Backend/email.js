const nodemailer = require('nodemailer');
const { escapeHtml } = require('./htmlEscape');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const enviarMailConfirmacion = async (emailCliente, nombreCliente, fechaHora, nombreNegocio, extra = {}) => {
  const turnoId = extra.turnoId;
  const direccion = extra.direccion;
  const lugar = direccion && String(direccion).trim()
    ? escapeHtml(direccion)
    : escapeHtml(nombreNegocio);

  try {
    const plantillaHTML = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #5b8c73; color: white; padding: 20px; text-align: center;">
                    <h2>${escapeHtml(nombreNegocio)}</h2>
                </div>
                <div style="padding: 20px;">
                    <h3 style="color: #333; text-align: center;">${escapeHtml(nombreCliente)}, tenés turno confirmado</h3>
                    <p style="color: #666; font-size: 14px; text-align: center;">
                      Referencia: <strong>#${escapeHtml(turnoId)}</strong>
                      <span style="background-color: #8b5cf6; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 8px;">Agendada</span>
                    </p>
                    <div style="text-align: left; background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p>📅 <strong>Fecha y hora:</strong> ${escapeHtml(fechaHora)}</p>
                        <p>📍 <strong>Lugar:</strong> ${lugar}</p>
                    </div>
                    <p style="color: #666; font-size: 14px; text-align: center;">
                      Para reprogramar o cancelar, contactá directamente al local.
                    </p>
                </div>
            </div>
        `;

    await transporter.sendMail({
      from: `"Turnero" <${process.env.EMAIL_USER}>`,
      to: emailCliente,
      subject: `Turno confirmado en ${nombreNegocio} 📅`,
      html: plantillaHTML
    });

    console.log(`📧 Mail enviado correctamente a ${emailCliente}`);
  } catch (error) {
    console.error('Error enviando el mail:', error);
  }
};

const enviarMailCancelacion = (emailCliente, nombreCliente, fechaHora, nombreNegocio, direccionNegocio) => {
  const lugar = direccionNegocio && String(direccionNegocio).trim()
    ? escapeHtml(direccionNegocio)
    : escapeHtml(nombreNegocio);

  const mailOptions = {
    from: `"Turnero" <${process.env.EMAIL_USER}>`,
    to: emailCliente,
    subject: `Cancelación de turno - ${nombreNegocio}`,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                <div style="background-color: #6c757d; color: white; padding: 20px; text-align: center;">
                    <h1>Turno cancelado</h1>
                </div>
                <div style="padding: 20px; color: #333;">
                    <p>Hola <strong>${escapeHtml(nombreCliente)}</strong>,</p>
                    <p>Te informamos que tu turno en <strong>${escapeHtml(nombreNegocio)}</strong> fue cancelado.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p><strong>Detalle:</strong></p>
                    <p>📅 Fecha y hora: ${escapeHtml(fechaHora)}</p>
                    <p>📍 Lugar: ${lugar}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p>Podés volver a reservar desde el enlace del negocio cuando quieras.</p>
                </div>
            </div>
        `
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.log('Error enviando mail de cancelación:', error);
    } else {
      console.log('📧 Mail de cancelación enviado a: ' + emailCliente);
    }
  });
};

module.exports = { enviarMailConfirmacion, enviarMailCancelacion };
