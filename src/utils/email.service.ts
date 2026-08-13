import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

// Verify connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Connection Error:', error);
    } else {
        console.log('Server is ready to take our messages');
    }
});

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    try {
        const info = await transporter.sendMail({
            from: `"Employee Management Platform" <${config.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        // In production, we might want to handle this better but for now we skip failing the whole request
        // if email fails in some environments
        return null;
    }
};

