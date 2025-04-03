import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/src/lib/stripe";
import { db } from "@/src/lib/db";

export async function POST(req: Request) {
  console.log("webhook called");

  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("Stripe-Signature") as string;
  //   const resend = new Resend(process.env.RESEND_API_KEY);

  let event: Stripe.Event;

  try {
    //         # If you are testing your webhook locally with the Stripe CLI you
    // # can find the endpoint's secret by running `stripe listen`
    // # Otherwise, find your endpoint's secret in your webhook settings in
    // # the Developer Dashboard
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.log("[STRIPE_CONSTRUCT_ERROR_39]", error);
    return new NextResponse(`STRIPE_CONSTRUCT_ERROR_39 ${error.message}`, {
      status: 500,
    });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.metadata?.registerId) {
      return new NextResponse("metadata not found in session", {
        status: 400,
      });
    }
    const invoice = await stripe.invoices.retrieve(session.invoice as string);
    const metadata = session.metadata;
    console.log("metadata => ", metadata);
    console.log("event == ", event);
    console.log("line:52 - metadata = ", metadata);
    // console.log("line:53 - invoice = ", invoice);
    if (event.type === "checkout.session.completed") {
      //update register record

      const stripeCustomerId = (session.customer as string) || ""; //TODO: get customer id from session
      const stripeCheckoutSessionId = session.id;
      const amountPaid = session.amount_total as number;
      const paymentStatus = session.payment_status;
      console.log("paymentStatus => ", paymentStatus);

      if (!metadata?.registerId) {
        return new NextResponse("registerId not found in metadata", {
          status: 400,
        });
      }
      const registerId = metadata.registerId as string;
      const email = metadata.customerEmail as string;
      if (paymentStatus === "paid") {
        const customer = await db.user.update({
          where: {
            email: email,
          },
          data: {
            stripeCustomerId,
            stripeCheckoutSessionId,
            subscriptionStart: new Date(),
            subscriptionValid: true,
          },
        });
      }
    }
  } catch (error: any) {
    console.log("[STRIPE_WEBHOOK_ERROR_85]", error);
  }

  return new NextResponse(null, { status: 200 });
}
