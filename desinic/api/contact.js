// api/contact.js — Vercel Serverless (Node.js + Nodemailer)
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, error:'Method not allowed' });
  }

  const { name, email, phone, company, message, source } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ ok:false, error:'Missing fields' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,                // p.ej. smtp.gmail.com / smtp.office365.com
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true=465, false=587
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const to = process.env.TO_EMAIL;              // destino final, ej. hola@levantiq.com
    const subject = 'Nuevo contacto — Levantiq';

    const text =
`Nombre:   ${name}
Email:    ${email}
Teléfono: ${phone || '-'}
Empresa:  ${company || '-'}
Origen:   ${source || 'levantiq-web'}

Mensaje:
${message}`;

    await transporter.sendMail({
      from: `"Levantiq Web" <${process.env.SMTP_USER}>`,
      to,
      replyTo: email,
      subject,
      text
    });

    return res.status(200).json({ ok:true });
  } catch (err) {
    console.error('Mailer error:', err);
    return res.status(500).json({ ok:false, error:'Mailer error' });
  }
};
