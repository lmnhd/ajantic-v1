import { db } from "@/src/lib/db";
import { getFetchUrl } from "@/src/lib/getFetchUrl";
import { stripe } from "@/src/lib/stripe";
import { redirect } from "next/dist/server/api-utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    console.log({
      userId,
    });
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" });
    }
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      select: {
        clerkId: true,
        email: true,
        lName: true,
        fName: true,
      },
    });

    const session = await stripe.checkout.sessions.create({
      // @ts-ignore
      billing_address_collection: "auto",
      success_url: `${getFetchUrl("/subscribe")}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: getFetchUrl("/subscribe"),
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user?.email,

      metadata: {
        clerkId: user?.clerkId,
        customerFirstName: user?.fName,
        customerLastName: user?.lName,

        customerEmail: user?.email,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product: "prod_PvXR4WIYJcf9lE",
            recurring: { interval: "month", interval_count: 1 },
            unit_amount: 1200, //$198.00,
          },
        },
      ],
    });

    //console.log("sessionURL", session.url);
    //   metadata: {

    //     registerId: preRegisterForm.id,
    //     customerFirstName: body.cabins[0].passengers[0].firstName,
    //     customerLastName: body.cabins[0].passengers[0].lastName,
    //     customerPhone: body.cabins[0].passengers[0].phone,
    //     customerEmail: email,
    //     cabinPrice: formatPrice(cabinPrice),
    //     cabinPriceNumber: cabinPrice,
    //     cabinType,
    //     payNowPrice: formatPrice(payNowPrice),
    //     payNowPriceNumber: payNowPrice,
    //     payNow,
    //     numPassengers: body.cabins[0].numPassengers,
    //     cabinId: cabin.id,
    //   },
    return NextResponse.json({ url: session.url });
    //return NextResponse.redirect(session.url || '/');
  } catch (err) {
    console.log("Error creating Checkout Session:", err);
    return NextResponse.json({ error: err });
  }
}
