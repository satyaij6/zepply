import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { error } = await supabase
      .from("waitlist")
      .insert([{ email: email.toLowerCase().trim(), created_at: new Date().toISOString() }]);

    if (error) {
      // Handle duplicate email gracefully
      if (error.code === "23505") {
        return NextResponse.json({ message: "Already on the list!" }, { status: 200 });
      }
      console.error("Supabase error:", error);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    return NextResponse.json({ message: "Success" }, { status: 200 });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
