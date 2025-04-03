import { db } from "@/src/lib/db";
import { getFetchUrl } from "@/src/lib/getFetchUrl";
import { stripe } from "@/src/lib/stripe";
import { redirect } from "next/dist/server/api-utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log({
      body,
    });
    const userId = null;
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

    const session = await stripe.billingPortal.sessions.create({
      customer: user?.clerkId!,
      return_url: getFetchUrl("/dashboard"),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.log("Error creating Billing Portal Session:", err);
    return NextResponse.json({ error: err });
  }
}
