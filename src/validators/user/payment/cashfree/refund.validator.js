import Joi from "joi";

export const refundWebhookSchema = Joi.object({
  type: Joi.string()
    .valid(
      "REFUND_STATUS_WEBHOOK",
      "AUTO_REFUND_STATUS_WEBHOOK",
      "SUBSCRIPTION_REFUND_STATUS"
    )
    .required(),

  event_time: Joi.string().isoDate().required(),

  data: Joi.when("type", {
    switch: [
      {
        is: "REFUND_STATUS_WEBHOOK",
        then: Joi.object({
          refund: Joi.object({
            cf_refund_id: Joi.number().required(),
            cf_payment_id: Joi.number().required(),
            refund_id: Joi.string().required(),
            order_id: Joi.string().required(),
            refund_amount: Joi.number().required(),
            refund_currency: Joi.string().required(),
            refund_status: Joi.string().required()
          }).required(),

          terminalDetails: Joi.object({
            cf_terminal_id: Joi.number().required(),
            terminal_phone: Joi.string().required()
          }).required()
        }).required()
      },

      {
        is: "AUTO_REFUND_STATUS_WEBHOOK",
        then: Joi.object({
          auto_refund: Joi.object({
            cf_refund_id: Joi.number().required(),
            cf_payment_id: Joi.string().required(),
            order_id: Joi.string().required(),
            refund_amount: Joi.number().required(),
            refund_currency: Joi.string().required(),
            refund_status: Joi.string().required()
          }).required(),

          terminalDetails: Joi.object({
            cf_terminal_id: Joi.number().required(),
            terminal_phone: Joi.string().required()
          }).required()
        }).required()
      },

      {
        is: "SUBSCRIPTION_REFUND_STATUS",
        then: Joi.object({
          payment_id: Joi.string().required(),
          cf_payment_id: Joi.string().required(),
          refund_id: Joi.string().required(),
          cf_refund_id: Joi.string().required(),
          refund_amount: Joi.number().required(),
          refund_speed: Joi.string().required(),
          refund_status: Joi.string().required(),

          refund_gateway_details: Joi.object({
            gateway_name: Joi.string().required(),
            gateway_payment_id: Joi.string().required(),
            gateway_refund_id: Joi.string().required()
          }).required()
        }).required()
      }
    ],

    otherwise: Joi.forbidden()
  })
});