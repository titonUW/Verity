import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { runOversightAgent, DEFAULT_AGENT_CONFIG } from "@/lib/agent";

export async function POST() {
  const auth = await requirePermission("agent.run");
  if ("error" in auth) return auth.error;

  try {
    const result = await runOversightAgent(prisma, DEFAULT_AGENT_CONFIG);

    // Log who triggered it
    await prisma.auditLog.create({
      data: {
        action: "AGENT_RUN",
        entityType: "SYSTEM",
        actor: auth.user.email,
        details: JSON.stringify({
          triggeredBy: auth.user.email,
          reportId: result.reportId,
        }),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent run failed:", error);
    return NextResponse.json(
      { error: "Agent run failed", message: String(error) },
      { status: 500 }
    );
  }
}
