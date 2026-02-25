import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("alerts.view");
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const severity = searchParams.get("severity");
  const acknowledged = searchParams.get("acknowledged");

  const where: Record<string, unknown> = {};
  if (severity) where.severity = severity;
  if (acknowledged !== null && acknowledged !== undefined && acknowledged !== "") {
    where.acknowledged = acknowledged === "true";
  }

  try {
    const [alerts, total, unacknowledgedCount] = await Promise.all([
      prisma.agentAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.agentAlert.count({ where }),
      prisma.agentAlert.count({ where: { acknowledged: false } }),
    ]);

    return NextResponse.json({
      alerts,
      total,
      unacknowledgedCount,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requirePermission("alerts.acknowledge");
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json({ error: "alertId required" }, { status: 400 });
    }

    const alert = await prisma.agentAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedBy: auth.user.email,
        acknowledgedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "ALERT_ACKNOWLEDGE",
        entityType: "SYSTEM",
        entityId: alertId,
        actor: auth.user.email,
        details: JSON.stringify({ alertType: alert.alertType }),
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error("Failed to acknowledge alert:", error);
    return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
  }
}
