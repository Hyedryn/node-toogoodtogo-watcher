import nodemailer from "nodemailer";
import { config } from "./config.js";

export function notifyEmail(textMessage,emailUUID) {
  var transporter = nodemailer.createTransport({
    host: config.get(`${emailUUID}.notifications.email.smtpHost`),
    port: parseInt(config.get(`${emailUUID}.notifications.email.smtpPort`)),
    secure: true, // upgrade later with STARTTLS
    auth: {
      user: config.get(`${emailUUID}.notifications.email.smtpUsername`),
      pass: config.get(`${emailUUID}.notifications.email.smtpPassword`),
    },
  });

  var mailOptions = {
    from: config.get(`${emailUUID}.notifications.email.smtpEmail`),
    to: config.get(`${emailUUID}.notifications.email.recipient`),
    subject: 'TooGoodToGo Notification from account ' + config.get(`${emailUUID}.api.credentials.email`) + ' ',
    html: textMessage
  };
  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("[Email notifications "+ config.get(`${emailUUID}.api.credentials.email`) +"] Server is ready to take our messages");
    }
  });

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('[Email notifications '+ config.get(`${emailUUID}.api.credentials.email`) +'] Email sent: ' + info.response);
    }
  });
}
