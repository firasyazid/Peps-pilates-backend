const getEmailTemplate = (title, bodyContent) => {
  // Use a fallback URL if BASE_URL is not defined in the environment variables
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const logoUrl = `${baseUrl}/uploads/pilate2.png`;

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        background-color: #f4f4f5;
        margin: 0;
        padding: 0;
        color: #333333;
      }
      .email-wrapper {
        width: 100%;
        background-color: #f4f4f5;
        padding: 40px 0;
      }
      .email-content {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      }
      .email-header {
        background-color: #fcfcfc;
        padding: 30px;
        text-align: center;
        border-bottom: 1px solid #eeeeee;
      }
      .email-header img {
        max-width: 150px;
        height: auto;
      }
      .email-body {
        padding: 40px 30px;
        line-height: 1.6;
        font-size: 16px;
      }
      .email-body h1, .email-body h2 {
        color: #2c3e50;
        margin-top: 0;
      }
      .email-footer {
        background-color: #fbfbfb;
        padding: 20px;
        text-align: center;
        font-size: 13px;
        color: #888888;
        border-top: 1px solid #eeeeee;
      }
      .btn {
        display: inline-block;
        padding: 12px 24px;
        background-color: #2c3e50;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
        margin: 20px 0;
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-content">
        <div class="email-header">
          <img src="${logoUrl}" alt="Peps Pilates Studio Logo">
        </div>
        <div class="email-body">
          ${bodyContent}
        </div>
        <div class="email-footer">
          <p>© ${new Date().getFullYear()} Peps Pilates Studio. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
};

module.exports = { getEmailTemplate };
