import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// GET — return current session user
export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("verity_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });
    return NextResponse.json({ user: user ?? null });
  } catch {
    return NextResponse.json({ user: null });
  }
}

// POST — set session (POC: select user by email)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set("verity_user_id", user.id, {
      httpOnly: true,
      secure: false, // POC only
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ error: "Failed to set session" }, { status: 500 });
  }
}

// DELETE — clear session
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("verity_user_id");
  return NextResponse.json({ ok: true });
}
