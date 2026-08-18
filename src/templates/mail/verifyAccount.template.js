const verifyAccountTemplate = (link) => {
  const expire = "30 minutes";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>DevTinder — Confirm your email</title>

  <style>
    html,
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100%;
    }

    body {
      background: #ffffff;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      overflow-x: hidden;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }

    img {
      border: 0;
      display: block;
      max-width: 100%;
    }

    a {
      text-decoration: none;
    }

    .email-wrapper {
      width: 100%;
      background: #ffffff;
    }

    .email-container {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      text-align: center;
      padding: 32px 16px 24px;
      box-sizing: border-box;
    }

    .brand {
      margin: 0;
      font-size: 25px;
      line-height: 1;
      font-weight: 700;
      letter-spacing: -1.15px;
    }

    .brand-dev {
      color: #111827;
    }

    .brand-tinder {
      color: #08ad72;
      font-weight: 500;
    }

    .content {
      margin-top: 43px;
    }

    .title {
      margin: 0;
      color: #111827;
      font-size: 27px;
      line-height: 1.22;
      font-weight: 700;
      letter-spacing: -0.85px;
    }

    .intro {
      max-width: 620px;
      margin: 21px auto 0;
      color: #667085;
      font-size: 16px;
      line-height: 1.62;
      font-weight: 400;
    }

    .cta {
      display: block;
      width: 100%;
      max-width: 360px;
      min-height: 58px;
      margin: 29px auto 0;
      padding: 15px 24px;
      box-sizing: border-box;

      background: #08ad72;
      color: #ffffff !important;

      border-radius: 5px;

      font-size: 18px;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: -0.15px;

      text-align: center;
      text-decoration: none;

      box-shadow: 0 2px 6px rgba(8, 173, 114, 0.12);
    }

    .expiry {
      margin: 29px 0 0;
      color: #667085;
      font-size: 17px;
      line-height: 1.5;
    }

    .expiry strong {
      color: #08ad72;
      font-weight: 500;
    }

    .security {
      max-width: 650px;
      margin: 40px auto 0;
      color: #667085;
      font-size: 15.5px;
      line-height: 1.6;
    }

    .divider {
      width: 100%;
      height: 1px;
      margin: 26px 0;
      padding: 0;
      border: 0;
      background: #dfe3e8;
    }

    .fallback {
      margin: 0;
      color: #667085;
      font-size: 15.5px;
      line-height: 1.6;
    }

    .verification-url {
      display: block;
      margin-top: 6px;

      color: #08ad72 !important;
      font-size: 15.5px;
      line-height: 1.55;
      font-weight: 500;

      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;

      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .footer {
      margin-top: 38px;
      color: #667085;
      font-size: 15.5px;
      line-height: 1.5;
    }

    @media screen and (min-width: 381px) {
      .content {
        margin-top: 50px;
      }

      .title {
        font-size: 30px;
      }
    }

    @media screen and (min-width: 600px) {
      .email-container {
        padding: 42px 24px 28px;
      }

      .brand {
        font-size: 28px;
      }

      .content {
        margin-top: 64px;
      }

      .title {
        font-size: 35px;
        line-height: 1.2;
      }

      .intro {
        margin-top: 25px;
        font-size: 19px;
        line-height: 1.68;
      }

      .desktop-break {
        display: block;
      }

      .cta {
        width: 333px;
        max-width: 333px;
        min-height: 62px;
        margin-top: 33px;
        font-size: 20px;
      }

      .expiry {
        margin-top: 34px;
        font-size: 18px;
      }

      .security {
        margin-top: 48px;
        font-size: 18px;
        line-height: 1.55;
      }

      .divider {
        margin: 29px 0;
      }

      .fallback {
        font-size: 17px;
      }

      .verification-url {
        margin-top: 5px;
        font-size: 17px;
        line-height: 1.6;
      }

      .footer {
        margin-top: 43px;
        font-size: 17px;
      }
    }

    @media screen and (min-width: 1600px) {
      .email-container {
        padding-top: 48px;
      }

      .content {
        margin-top: 68px;
      }
    }

    @media screen and (max-width: 599px) {
      .desktop-break {
        display: none;
      }
    }
  </style>
</head>

<body>
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    class="email-wrapper"
  >
    <tr>
      <td align="center">

        <div class="email-container">

          <!-- Brand -->
          <header>
            <p class="brand" aria-label="DevTinder">
              <span class="brand-dev">Dev</span><span class="brand-tinder">Tinder</span>
            </p>
          </header>

          <div class="content">

            <!-- Title -->
            <h1 class="title">
              Confirm your email address
            </h1>

            <!-- Intro -->
            <p class="intro">
              Welcome to DevTinder. Please confirm your email address
              <br class="desktop-break" />
              to activate your account and start connecting with developers.
            </p>

            <!-- CTA -->
            <a
              href="${link}"
              class="cta"
              target="_blank"
              rel="noopener noreferrer"
            >
              Confirm Email
            </a>

            <!-- Expiry -->
            <p class="expiry">
              This link expires in
              <strong>${expire}.</strong>
            </p>

            <!-- Security Message -->
            <p class="security">
              If you didn't create a DevTinder account, you can safely
              ignore this email.
            </p>

            <!-- Divider -->
            <hr class="divider" />

            <!-- Fallback Text -->
            <p class="fallback">
              Having trouble with the button? Copy and paste the
              verification link into your browser.
            </p>

            <!-- Verification URL -->
            <a
              href="${link}"
              class="verification-url"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${link}
            </a>

            <!-- Footer -->
            <footer class="footer">
              © 2026 DevTinder · Build together.
            </footer>

          </div>

        </div>

      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
};

export default verifyAccountTemplate;
