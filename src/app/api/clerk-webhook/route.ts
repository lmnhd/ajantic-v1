import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const request = await req.json();
    const body = request.data;
    console.log("body", body);

    const { id, email_addresses, first_name, image_url } = body;
    const {verification} = email_addresses[0];

    const email = email_addresses[0]?.email_address;
    console.log("👌 ", verification);
    await db.user.upsert({
      where: { clerkId: id },
      update: {
        email,
        fName: first_name || "",
        profileImage: image_url || "",
      },
      create: {
        clerkId: id,
        email,
        fName: first_name || "",
        profileImage: image_url || "",
      },
    });

    return new NextResponse("User updated successfully", { status: 200 });
  } catch (error) {
    console.error("🔥 ", error);
    return new NextResponse("Error updating user in database", { status: 500 });
  }
}
