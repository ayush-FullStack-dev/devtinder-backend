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
  <meta charset="UTF-8">

  <meta
    http-equiv="X-UA-Compatible"
    content="IE=edge"
  >

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="format-detection"
    content="telephone=no,address=no,email=no,date=no,url=no"
  >

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

    /* =========================================================
       RESET
    ========================================================= */

    html,
    body {
      width: 100% !important;
      min-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f4f5f7;
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

    img {
      display: block;
      border: 0;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }

    a {
      color: inherit;
    }

    p {
      margin: 0;
    }

    * {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }


    /* =========================================================
       OUTER WRAPPER
    ========================================================= */

    .email-wrapper {
      width: 100%;
      background-color: #f4f5f7;
    }

    .outer-cell {
      padding: 48px 24px;
    }


    /* =========================================================
       MAIN CONTAINER
    ========================================================= */

    .email-container {
      width: 100%;
      max-width: 640px;

      background-color: #ffffff;

      border: 1px solid #e1e4e8;
      border-radius: 16px;

      overflow: hidden;

      box-shadow:
        0 2px 5px rgba(16, 24, 40, 0.03),
        0 12px 32px rgba(16, 24, 40, 0.06);
    }


    /* =========================================================
       HEADER
    ========================================================= */

    .header-cell {
      padding: 34px 42px 30px;
      background-color: #ffffff;
    }

    .brand-table {
      width: auto;
    }

    .brand-logo-cell {
      padding: 0 14px 0 0;
      vertical-align: middle;
    }

    .brand-logo {
      width: 48px;
      height: auto;
    }

    .brand-name-cell {
      vertical-align: middle;
      padding: 0;
    }

    .brand-wordmark {
      display: block;
      width: 174px;
      height: auto;
    }


    /* =========================================================
       DIVIDER
    ========================================================= */

    .divider {
      width: 100%;
      height: 1px;
      background-color: #e7e9ec;
      line-height: 1px;
      font-size: 1px;
    }


    /* =========================================================
       CONTENT
    ========================================================= */

    .content-cell {
      padding: 42px 42px 44px;

      font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        Helvetica,
        Arial,
        sans-serif;

      font-size: 16px;
      line-height: 1.65;

      color: #30343a;
    }


    /* =========================================================
       GREETING
    ========================================================= */

    .greeting {
      margin: 0 0 20px;

      font-size: 17px;
      line-height: 1.55;

      font-weight: 500;

      color: #17191c;
    }


    /* =========================================================
       INTRO
    ========================================================= */

    .intro {
      margin: 0 0 38px;

      font-size: 17px;
      line-height: 1.65;

      font-weight: 400;

      color: #30343a;
    }

    .intro strong {
      font-weight: 700;
      color: #17191c;
    }


    /* =========================================================
       SIGN-IN INFORMATION
    ========================================================= */

    .info-table {
      width: auto;

      font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        Helvetica,
        Arial,
        sans-serif;

      font-size: 15.5px;
      line-height: 1.55;

      color: #30343a;
    }

    .info-label {
      padding: 0 16px 11px 0;

      font-weight: 700;

      color: #16181b;

      white-space: nowrap;
    }

    .info-value {
      padding: 0 0 11px;

      font-weight: 400;

      color: #4b5057;
    }

    .info-label-last {
      padding: 0 16px 0 0;

      font-weight: 700;

      color: #16181b;

      white-space: nowrap;
    }

    .info-value-last {
      padding: 0;

      font-weight: 400;

      color: #4b5057;
    }


    /* =========================================================
       SECURITY COPY
    ========================================================= */

    .safe-message {
      margin: 48px 0 20px;

      font-size: 16px;
      line-height: 1.65;

      font-weight: 500;

      color: #30343a;
    }

    .security-message {
      margin: 0 0 44px;

      font-size: 16px;
      line-height: 1.65;

      font-weight: 400;

      color: #30343a;
    }

    .security-link {
      color: #181a1d;
      font-weight: 650;

      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }


    /* =========================================================
       SIGNATURE
    ========================================================= */

    .signature {
      font-size: 16px;
      line-height: 1.6;

      font-weight: 400;

      color: #30343a;
    }

    .signature strong {
      font-weight: 700;
      color: #17191c;
    }

    .signature .team {
      font-style: italic;
      font-weight: 500;
      color: #555a61;
    }


    /* =========================================================
       FOOTER
    ========================================================= */

    .footer-divider {
      padding: 0 42px;
    }

    .footer-cell {
      padding: 24px 42px 34px;

      font-family:
        Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        Helvetica,
        Arial,
        sans-serif;

      font-size: 13px;
      line-height: 1.55;

      color: #777c83;
    }


    /* =========================================================
       TABLET
    ========================================================= */

    @media screen and (max-width: 680px) {

      .outer-cell {
        padding: 30px 16px !important;
      }

      .email-container {
        max-width: 100% !important;
      }

      .header-cell {
        padding: 32px 32px 28px !important;
      }

      .content-cell {
        padding: 38px 32px 40px !important;
      }

      .footer-divider {
        padding: 0 32px !important;
      }

      .footer-cell {
        padding: 23px 32px 32px !important;
      }

      .brand-logo {
        width: 46px !important;
      }

      .brand-wordmark {
        width: 165px !important;
      }
    }


    /* =========================================================
       MOBILE
    ========================================================= */

    @media screen and (max-width: 600px) {

      .outer-cell {
        padding: 0 !important;
      }

      .email-container {
        width: 100% !important;
        max-width: 100% !important;

        border-left: 0 !important;
        border-right: 0 !important;

        border-radius: 0 !important;

        box-shadow: none !important;
      }

      .header-cell {
        padding: 28px 24px 25px !important;
      }

      .brand-logo-cell {
        padding-right: 11px !important;
      }

      .brand-logo {
        width: 44px !important;
      }

      .brand-wordmark {
        width: 150px !important;
        max-width: 100% !important;
      }

      .content-cell {
        padding: 34px 24px 35px !important;

        font-size: 16px !important;
        line-height: 1.65 !important;
      }

      .greeting {
        margin-bottom: 19px !important;
        font-size: 16.5px !important;
      }

      .intro {
        margin-bottom: 34px !important;
        font-size: 16.5px !important;
      }

      .info-table {
        width: 100% !important;
        font-size: 15px !important;
      }

      .info-label,
      .info-label-last {
        padding-right: 9px !important;
      }

      .info-value,
      .info-value-last {
        word-break: break-word !important;
      }

      .safe-message {
        margin-top: 43px !important;
        margin-bottom: 19px !important;
        font-size: 15.5px !important;
      }

      .security-message {
        margin-bottom: 39px !important;
        font-size: 15.5px !important;
      }

      .signature {
        font-size: 15.5px !important;
      }

      .footer-divider {
        padding: 0 24px !important;
      }

      .footer-cell {
        padding: 22px 24px 30px !important;
        font-size: 12.5px !important;
      }
    }


    /* =========================================================
       SMALL PHONES
    ========================================================= */

    @media screen and (max-width: 420px) {

      .header-cell {
        padding: 25px 20px 23px !important;
      }

      .brand-logo-cell {
        padding-right: 9px !important;
      }

      .brand-logo {
        width: 40px !important;
      }

      .brand-wordmark {
        width: 136px !important;
      }

      .content-cell {
        padding: 30px 20px 32px !important;
      }

      .greeting {
        font-size: 16px !important;
      }

      .intro {
        font-size: 16px !important;
      }

      .info-table {
        font-size: 14.5px !important;
      }

      .info-label,
      .info-label-last {
        padding-right: 7px !important;
      }

      .safe-message,
      .security-message,
      .signature {
        font-size: 15px !important;
      }

      .footer-divider {
        padding: 0 20px !important;
      }

      .footer-cell {
        padding: 21px 20px 28px !important;
      }
    }


    /* =========================================================
       VERY SMALL PHONES
    ========================================================= */

    @media screen and (max-width: 350px) {

      .brand-logo {
        width: 36px !important;
      }

      .brand-wordmark {
        width: 120px !important;
      }

      .info-table {
        font-size: 14px !important;
      }

      .info-label,
      .info-label-last {
        padding-right: 5px !important;
      }
    }

  </style>
</head>


<body
  style="
    margin:0;
    padding:0;
    width:100%;
    background-color:#f4f5f7;
  "
>

  <!-- =======================================================
       OUTER WRAPPER
  ======================================================== -->

  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    class="email-wrapper"
    style="
      width:100%;
      background-color:#f4f5f7;
    "
  >

    <tr>

      <td
        align="center"
        valign="top"
        class="outer-cell"
        style="
          padding:48px 24px;
        "
      >

        <!--[if mso]>
        <table
          role="presentation"
          width="640"
          align="center"
          cellpadding="0"
          cellspacing="0"
          border="0"
        >
          <tr>
            <td>
        <![endif]-->


        <!-- =================================================
             EMAIL CONTAINER
        ================================================== -->

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          align="center"
          class="email-container"
          style="
            width:100%;
            max-width:640px;
            background-color:#ffffff;
            border:1px solid #e1e4e8;
            border-radius:16px;
            overflow:hidden;
          "
        >

          <tr>

            <td
              valign="top"
              style="
                background-color:#ffffff;
              "
            >


              <!-- ===========================================
                   HEADER
              ============================================ -->

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                <tr>

                  <td
                    class="header-cell"
                    style="
                      padding:34px 42px 30px;
                    "
                  >

                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      class="brand-table"
                    >

                      <tr>

                        <!-- LOGO MARK -->

                        <td
                          class="brand-logo-cell"
                          valign="middle"
                          style="
                            padding:0 14px 0 0;
                            vertical-align:middle;
                          "
                        >

                          <img
                            src="https://devtinder.tech/brand/logo/logo-mark-monochrome.svg"
                            width="48"
                            alt=""
                            class="brand-logo"
                            style="
                              display:block;
                              width:48px;
                              height:auto;
                              border:0;
                              outline:none;
                              text-decoration:none;
                            "
                          >

                        </td>


                        <!-- WORDMARK -->

                        <td
                          class="brand-name-cell"
                          valign="middle"
                          style="
                            vertical-align:middle;
                            padding:0;
                          "
                        >

                          <img
                            src="https://devtinder.tech/brand/logo/monochrome-wordmark.svg"
                            width="174"
                            alt="DevTinder"
                            class="brand-wordmark"
                            style="
                              display:block;
                              width:174px;
                              height:auto;
                              border:0;
                              outline:none;
                              text-decoration:none;
                            "
                          >

                        </td>

                      </tr>

                    </table>

                  </td>

                </tr>

              </table>


              <!-- ===========================================
                   HEADER DIVIDER
              ============================================ -->

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                <tr>

                  <td
                    class="divider"
                    height="1"
                    style="
                      width:100%;
                      height:1px;
                      line-height:1px;
                      font-size:1px;
                      background-color:#e7e9ec;
                    "
                  >
                    &nbsp;
                  </td>

                </tr>

              </table>


              <!-- ===========================================
                   BODY CONTENT
              ============================================ -->

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                <tr>

                  <td
                    class="content-cell"
                    style="
                      padding:42px 42px 44px;
                      font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                      font-size:16px;
                      line-height:1.65;
                      font-weight:400;
                      color:#30343a;
                    "
                  >

                    <!-- GREETING -->

                    <p
                      class="greeting"
                      style="
                        margin:0 0 20px;
                        font-size:17px;
                        line-height:1.55;
                        font-weight:500;
                        color:#17191c;
                      "
                    >
                      Hello${name ? `, ${name}` : ""}!
                    </p>


                    <!-- INTRO -->

                    <p
                      class="intro"
                      style="
                        margin:0 0 38px;
                        font-size:17px;
                        line-height:1.65;
                        font-weight:400;
                        color:#30343a;
                      "
                    >
                      We noticed a new sign-in to your
                      <strong
                        style="
                          font-weight:700;
                          color:#17191c;
                        "
                      >
                        DevTinder
                      </strong>
                      account.
                    </p>


                    <!-- =====================================
                         SIGN-IN DETAILS
                    ====================================== -->

                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      class="info-table"
                      style="
                        width:auto;
                        font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                        font-size:15.5px;
                        line-height:1.55;
                        color:#30343a;
                      "
                    >

                      <tr>

                        <td
                          class="info-label"
                          style="
                            padding:0 16px 11px 0;
                            font-weight:700;
                            color:#16181b;
                            white-space:nowrap;
                          "
                        >
                          App:
                        </td>

                        <td
                          class="info-value"
                          style="
                            padding:0 0 11px;
                            font-weight:400;
                            color:#4b5057;
                          "
                        >
                          DevTinder Web
                        </td>

                      </tr>


                      <tr>

                        <td
                          class="info-label"
                          style="
                            padding:0 16px 11px 0;
                            font-weight:700;
                            color:#16181b;
                            white-space:nowrap;
                          "
                        >
                          Time:
                        </td>

                        <td
                          class="info-value"
                          style="
                            padding:0 0 11px;
                            font-weight:400;
                            color:#4b5057;
                          "
                        >
                          ${time || "Unknown"}
                        </td>

                      </tr>


                      <tr>

                        <td
                          class="info-label"
                          style="
                            padding:0 16px 11px 0;
                            font-weight:700;
                            color:#16181b;
                            white-space:nowrap;
                          "
                        >
                          Location:
                        </td>

                        <td
                          class="info-value"
                          style="
                            padding:0 0 11px;
                            font-weight:400;
                            color:#4b5057;
                          "
                        >
                          ${location || "Unknown"}
                        </td>

                      </tr>


                      <tr>

                        <td
                          class="info-label"
                          style="
                            padding:0 16px 11px 0;
                            font-weight:700;
                            color:#16181b;
                            white-space:nowrap;
                          "
                        >
                          IP Address:
                        </td>

                        <td
                          class="info-value"
                          style="
                            padding:0 0 11px;
                            font-weight:400;
                            color:#4b5057;
                          "
                        >
                          ${ip || "Unknown"}
                        </td>

                      </tr>


                      <tr>

                        <td
                          class="info-label-last"
                          style="
                            padding:0 16px 0 0;
                            font-weight:700;
                            color:#16181b;
                            white-space:nowrap;
                          "
                        >
                          Device:
                        </td>

                        <td
                          class="info-value-last"
                          style="
                            padding:0;
                            font-weight:400;
                            color:#4b5057;
                          "
                        >
                          ${device || "Unknown"}
                        </td>

                      </tr>

                    </table>


                    <!-- SAFE MESSAGE -->

                    <p
                      class="safe-message"
                      style="
                        margin:48px 0 20px;
                        font-size:16px;
                        line-height:1.65;
                        font-weight:500;
                        color:#30343a;
                      "
                    >
                      If this was you, no action is needed.
                    </p>


                    <!-- SECURITY MESSAGE -->

                    <p
                      class="security-message"
                      style="
                        margin:0 0 44px;
                        font-size:16px;
                        line-height:1.65;
                        font-weight:400;
                        color:#30343a;
                      "
                    >
                      If you don't recognize this activity, please
                      <a
                        href="${reset_link || "#"}"
                        class="security-link"
                        style="
                          color:#181a1d;
                          font-weight:650;
                          text-decoration:underline;
                          text-decoration-thickness:1px;
                          text-underline-offset:3px;
                        "
                      >
                        review your account security
                      </a>
                      right away.
                    </p>


                    <!-- SIGNATURE -->

                    <p
                      class="signature"
                      style="
                        margin:0;
                        font-size:16px;
                        line-height:1.6;
                        font-weight:400;
                        color:#30343a;
                      "
                    >
                      Thanks,<br>

                      <strong
                        style="
                          font-weight:700;
                          color:#17191c;
                        "
                      >
                        DevTinder
                      </strong>

                      <span
                        class="team"
                        style="
                          font-style:italic;
                          font-weight:500;
                          color:#555a61;
                        "
                      >
                        Team
                      </span>
                    </p>

                  </td>

                </tr>

              </table>


              <!-- ===========================================
                   FOOTER DIVIDER
              ============================================ -->

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                <tr>

                  <td
                    class="footer-divider"
                    style="
                      padding:0 42px;
                    "
                  >

                    <div
                      class="divider"
                      style="
                        width:100%;
                        height:1px;
                        line-height:1px;
                        font-size:1px;
                        background-color:#e7e9ec;
                      "
                    >
                      &nbsp;
                    </div>

                  </td>

                </tr>

              </table>


              <!-- ===========================================
                   FOOTER
              ============================================ -->

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >

                <tr>

                  <td
                    class="footer-cell"
                    style="
                      padding:24px 42px 34px;
                      font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                      font-size:13px;
                      line-height:1.55;
                      font-weight:400;
                      color:#777c83;
                    "
                  >
                    This message was sent from DevTinder.
                  </td>

                </tr>

              </table>

            </td>

          </tr>

        </table>


        <!--[if mso]>
            </td>
          </tr>
        </table>
        <![endif]-->

      </td>

    </tr>

  </table>

</body>
</html>`;

  return html;
};

export default newLoginAlertTemplete;
