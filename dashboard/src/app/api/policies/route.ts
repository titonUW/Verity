import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DEFAULT_POLICIES } from "@/lib/scoring";

export async function GET() {
  try {
    // Get workflows from database
    const workflows = await prisma.policyWorkflow.findMany({
      include: {
        versions: {
          orderBy: { publishedAt: "desc" },
        },
      },
    });

    // If no workflows in DB, return defaults
    if (workflows.length === 0) {
      const defaultWorkflows = Object.entries(DEFAULT_POLICIES).map(([name, policy]) => ({
        id: name,
        name,
        description: `${name} workflow`,
        versions: [{
          id: `${name}-v1`,
          version: policy.version,
          publishedAt: new Date().toISOString(),
          isActive: true,
          policy,
        }],
      }));

      return NextResponse.json(defaultWorkflows);
    }

    // Transform workflows with parsed policy JSON
    const transformed = workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      versions: w.versions.map((v) => ({
        id: v.id,
        version: v.version,
        publishedAt: v.publishedAt,
        isActive: v.isActive,
        policy: JSON.parse(v.policyJson),
      })),
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error("Error fetching policies:", error);
    return NextResponse.json(
      { error: "Failed to fetch policies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowName, policy } = body;

    if (!workflowName || !policy) {
      return NextResponse.json(
        { error: "Missing workflowName or policy" },
        { status: 400 }
      );
    }

    // Find or create workflow
    let workflow = await prisma.policyWorkflow.findUnique({
      where: { name: workflowName },
    });

    if (!workflow) {
      workflow = await prisma.policyWorkflow.create({
        data: {
          name: workflowName,
          description: policy.description || `${workflowName} workflow`,
        },
      });
    }

    // Deactivate previous versions
    await prisma.policyVersion.updateMany({
      where: { workflowId: workflow.id },
      data: { isActive: false },
    });

    // Create new version
    const version = await prisma.policyVersion.create({
      data: {
        workflowId: workflow.id,
        version: policy.version,
        policyJson: JSON.stringify(policy),
        isActive: true,
        createdBy: "admin",
      },
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: "POLICY_CHANGE",
        entityType: "POLICY",
        entityId: version.id,
        actor: "admin",
        details: JSON.stringify({
          workflowName,
          version: policy.version,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      versionId: version.id,
    });
  } catch (error) {
    console.error("Error creating policy:", error);
    return NextResponse.json(
      { error: "Failed to create policy" },
      { status: 500 }
    );
  }
}
