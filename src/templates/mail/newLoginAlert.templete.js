const newLoginAlertTemplete = (
  name,
  ip,
  location,
  device,
  browser,
  time,
  reset_link,
) => {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />

    <meta
      http-equiv="X-UA-Compatible"
      content="IE=edge"
    />

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />

    <meta
      name="format-detection"
      content="telephone=no,address=no,email=no,date=no,url=no"
    />

    <title>DevTinder — New Sign-In Alert</title>

    <!--[if mso]>
      <style type="text/css">
        table,
        td {
          border-collapse: collapse !important;
        }

        body,
        table,
        td,
        p,
        a {
          font-family: Arial, Helvetica, sans-serif !important;
        }
      </style>
    <![endif]-->

    <style type="text/css">
      html,
      body {
        width: 100% !important;
        min-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      body {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
        font-family:
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          Helvetica,
          Arial,
          sans-serif;
        color: #171717;
      }

      table {
        border-spacing: 0;
        border-collapse: collapse;
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }

      td {
        border-collapse: collapse;
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }

      p,
      h1 {
        margin: 0;
        padding: 0;
      }

      a {
        color: inherit;
      }

      img {
        display: block;
        border: 0;
        outline: none;
        text-decoration: none;
        -ms-interpolation-mode: bicubic;
      }

      * {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }

      .email-wrapper {
        width: 100%;
        background: #ffffff;
      }

      .email-container {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
      }

      .footer {
        text-align: center;
      }

      .body-text {
        font-size: 15px;
        line-height: 23px;
        font-weight: 400;
        color: #171717;
      }

      .detail-text {
        font-size: 15px;
        line-height: 23px;
        font-weight: 400;
        color: #171717;
      }

      /*
       * Keep the complete sign-in information visually light.
       * Only a very subtle weight difference is used for labels.
       */
      .detail-label {
        font-weight: 500;
      }

      .footer-text {
        font-size: 13px;
        line-height: 20px;
        font-weight: 400;
        color: #737373;
        text-align: center;
      }

      @media screen and (max-width: 640px) {
        .outer-cell {
          padding-left: 20px !important;
          padding-right: 20px !important;
        }

        .email-container {
          width: 100% !important;
          max-width: 100% !important;
        }
      }

      @media screen and (max-width: 480px) {
        .outer-cell {
          padding-left: 20px !important;
          padding-right: 20px !important;
        }

        .top-mark {
          padding-top: 24px !important;
        }

        .heading {
          padding-top: 44px !important;
        }

        .heading h1 {
          font-size: 21px !important;
          line-height: 28px !important;
          font-weight: 400 !important;
        }

        .body-text,
        .detail-text {
          font-size: 15px !important;
          line-height: 23px !important;
          font-weight: 400 !important;
        }

        .detail-label {
          font-weight: 500 !important;
        }

        .footer-text {
          font-size: 13px !important;
          line-height: 20px !important;
        }
      }
    </style>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background: #ffffff;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      class="email-wrapper"
      style="
        width: 100%;
        background: #ffffff;
      "
    >
      <tr>
        <td
          align="center"
          valign="top"
          class="outer-cell"
          style="
            padding: 0 24px;
          "
        >
          <table
            role="presentation"
            width="600"
            cellpadding="0"
            cellspacing="0"
            border="0"
            align="center"
            class="email-container"
            style="
              width: 600px;
              max-width: 100%;
              margin: 0 auto;
            "
          >

            <!-- DevTinder Logo -->
            <tr>
              <td
                class="top-mark"
                style="
                  padding: 26px 0 0 0;
                  line-height: 0;
                "
              >
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    border-collapse: collapse;
                    border-spacing: 0;
                  "
                >
                  <tr>

                    <td
                      valign="middle"
                      style="
                        padding: 0;
                        vertical-align: middle;
                        line-height: 0;
                      "
                    >
                      <img
                        src=${process.env.DOMAIN_LINK}/brand/logo/monochrome-icon.svg}
                        alt="DevTinder"
                        width="50"
                        style="
                          display: block;
                          width: 50px;
                          height: auto;
                          border: 0;
                          outline: none;
                          text-decoration: none;
                        "
                      />
                    </td>

                    <td
                      width="14"
                      style="
                        width: 14px;
                        min-width: 14px;
                        padding: 0;
                        font-size: 0;
                        line-height: 0;
                      "
                    >
                      &nbsp;
                    </td>

                    <td
                      valign="middle"
                      style="
                        padding: 0;
                        vertical-align: middle;
                        line-height: 0;
                      "
                    >
                      <img
                        src="${process.env.DOMAIN_LINK}/brand/logo/monochrome-wordmark.svg"
                        alt="DevTinder"
                        width="150"
                        style="
                          display: block;
                          width: 150px;
                          height: auto;
                          border: 0;
                          outline: none;
                          text-decoration: none;
                        "
                      />
                    </td>

                  </tr>
                </table>
              </td>
            </tr>

            <!-- Heading -->
            <tr>
              <td
                class="heading"
                style="
                  padding: 48px 0 0 0;
                "
              >
                <h1
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 22px;
                    line-height: 29px;
                    font-weight: 400;
                    letter-spacing: -0.35px;
                    color: #171717;
                  "
                >
                  New sign-in detected on your DevTinder account
                </h1>
              </td>
            </tr>

            <!-- Greeting -->
            <tr>
              <td style="padding: 26px 0 0 0;">
                <p
                  class="body-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  Hello,
                  <strong
                    style="
                      font-weight: 500;
                    "
                  >
                    ${name || "there"}.
                  </strong>
                </p>
              </td>
            </tr>

            <!-- Description -->
            <tr>
              <td style="padding: 18px 0 0 0;">
                <p
                  class="body-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  Your DevTinder account was recently signed-in from a new
                  location, device or browser:
                </p>
              </td>
            </tr>

            <!-- Sign-in Details -->
            <tr>
              <td style="padding: 14px 0 0 0;">

                <p
                  class="detail-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  <strong
                    class="detail-label"
                    style="font-weight: 500;"
                  >
                    Location:
                  </strong>
                  ${location || "Unknown"}
                </p>

                <p
                  class="detail-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  <strong
                    class="detail-label"
                    style="font-weight: 500;"
                  >
                    Time:
                  </strong>
                  ${time || "Unknown"}
                </p>

                <p
                  class="detail-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  <strong
                    class="detail-label"
                    style="font-weight: 500;"
                  >
                    Browser:
                  </strong>
                  ${browser || "Unknown"}
                </p>

                <p
                  class="detail-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  <strong
                    class="detail-label"
                    style="font-weight: 500;"
                  >
                    Device:
                  </strong>
                  ${device || "Unknown"}
                </p>

                <p
                  class="detail-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  <strong
                    class="detail-label"
                    style="font-weight: 500;"
                  >
                    IP:
                  </strong>
                  ${ip || "Unknown"}
                </p>

              </td>
            </tr>

            <!-- Security Question -->
            <tr>
              <td style="padding: 23px 0 0 0;">
                <p
                  class="body-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 600;
                    color: #171717;
                  "
                >
                  Don't recognize this activity?
                </p>
              </td>
            </tr>

            <!-- Security Link -->
            <tr>
              <td style="padding: 8px 0 0 0;">
                <p
                  class="body-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  Review your
                  <a
                    href="${
                      reset_link ||
                      `${process.env.DOMAIN_LINK}/account/reset-password`
                    }"
                    style="
                      color: #0070f3;
                      text-decoration: none;
                    "
                  >
                    account security
                  </a>
                  now.
                </p>
              </td>
            </tr>

            <!-- Explanation -->
            <tr>
              <td style="padding: 18px 0 0 0;">
                <p
                  class="body-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 15px;
                    line-height: 23px;
                    font-weight: 400;
                    color: #171717;
                  "
                >
                  This alert triggers when we detect a sign-in from an
                  unrecognized location, device, or browser. Common causes
                  include traveling, using a VPN or Private Relay, or
                  signing in from a new browser.
                </p>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding: 40px 0 0 0;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                >
                  <tr>
                    <td
                      style="
                        width: 100%;
                        height: 1px;
                        border-top: 1px solid #eaeaea;
                        font-size: 0;
                        line-height: 0;
                      "
                    >
                      &nbsp;
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                class="footer"
                style="
                  padding: 28px 0 0 0;
                  text-align: center;
                "
              >
                <p
                  class="footer-text"
                  style="
                    margin: 0;
                    padding: 0;
                    font-size: 13px;
                    line-height: 20px;
                    font-weight: 400;
                    color: #737373;
                    text-align: center;
                  "
                >
                  <a
                    href="${process.env.DOMAIN_LINK}/terms"
                    style="
                      color: #737373;
                      text-decoration: underline;
                    "
                  >
                    Terms of Service
                  </a>

                  <span
                    style="
                      padding: 0 6px;
                      color: #b5b5b5;
                    "
                  >
                    ·
                  </span>

                  <a
                    href="${process.env.DOMAIN_LINK}/privacy"
                    style="
                      color: #737373;
                      text-decoration: underline;
                    "
                  >
                    Privacy Policy
                  </a>
                </p>

                <p
                  class="footer-text"
                  style="
                    margin: 7px 0 0 0;
                    padding: 0;
                    font-size: 13px;
                    line-height: 20px;
                    font-weight: 400;
                    color: #737373;
                    text-align: center;
                  "
                >
                  Copyright © 2026 DevTinder. All rights reserved.
                </p>
              </td>
            </tr>

            <!-- Bottom Space -->
            <tr>
              <td
                style="
                  height: 36px;
                  font-size: 0;
                  line-height: 0;
                "
              >
                &nbsp;
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return html;
};

export default newLoginAlertTemplete;
