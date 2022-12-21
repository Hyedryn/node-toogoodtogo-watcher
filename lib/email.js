const nodemailer = require('nodemailer');
const { config } = require("./config");

module.exports = {
  notifyEmail,
};

function notifyEmail(textMessage) {
  var transporter = nodemailer.createTransport({
    host: config.get("notifications.email.smtpHost"),
    port: parseInt(config.get("notifications.email.smtpPort")),
    secure: true, // upgrade later with STARTTLS
    auth: {
      user: config.get("notifications.email.smtpUsername"),
      pass: config.get("notifications.email.smtpPassword"),
    },
  });

  var mailOptions = {
    from: config.get("notifications.email.smtpEmail"),
    to: config.get("notifications.email.recipient"),
    subject: 'TooGoodToGo Notification from account ' + config.get("api.credentials.email") + ' ',
    html: textMessage
  };
  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("[Email notifications] Server is ready to take our messages");
    }
  });

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('[Email notifications] Email sent: ' + info.response);
    }
  });
}
