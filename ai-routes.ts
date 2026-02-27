// @ts-nocheck
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { complaints, aiAnalysis, complaintClusters, complaintClusterLinks, complaintTimeline, workOrders, staffProfiles, contractorProfiles, users, auditLogs, workOrderResources } from "../shared/schema";
import { eq, desc, and, sql, ne, or, count, avg, gte, lte } from "drizzle-orm";
import { openai } from "./replit_integrations/audio/client";

const categoryMap: Record<string, string> = {
  "road": "Infrastructure - Roads",
  "pothole": "Infrastructure - Roads",
  "drainage": "Infrastructure - Drainage",
  "sewage": "Infrastructure - Drainage",
  "water_supply": "Water Supply",
  "water_leak": "Water Supply",
  "electricity": "Electrical",
  "streetlight": "Electrical",
  "garbage": "Sanitation - Waste",
  "waste": "Sanitation - Waste",
  "park": "Parks & Gardens",
  "building": "Building & Construction",
  "noise": "Environment",
  "pollution": "Environment",
  "encroachment": "Land & Property",
  "other": "General Administration",
};

const departmentForCategory: Record<string, string> = {
  "Infrastructure - Roads": "Municipal Corp - Engineering Dept",
  "Infrastructure - Drainage": "Municipal Corp - Engineering Dept",
  "Water Supply": "PHE Department - Raipur",
  "Electrical": "CSPDCL - Raipur Division",
  "Sanitation - Waste": "Municipal Corp - Sanitation Dept",
  "Parks & Gardens": "Municipal Corp - Engineering Dept",
  "Building & Construction": "Municipal Corp - Engineering Dept",
  "Environment": "General Administration",
  "Land & Property": "General Administration",
  "General Administration": "General Administration",
};

const SLA_HOURS: Record<string, number> = {
  "critical": 4,
  "high": 24,
  "medium": 72,
  "low": 168,
};

export function registerAIRoutes(app: Express): void {

  app.post("/api/ai/analyze-complaint", async (req: Request, res: Response) => {
    try {
      const { complaintId, description, category, service, locationAddress } = req.body;

      if (!description) {
        return res.status(400).json({ success: false, message: "Description required" });
      }

      const prompt = `Analyze this citizen complaint and provide a JSON response with these fields:
- category: one of [road, pothole, drainage, sewage, water_supply, water_leak, electricity, streetlight, garbage, waste, park, building, noise, pollution, encroachment, other]
- urgency: one of [low, medium, high, critical]
- priorityScore: 1-100 (100 being most urgent)
- sentiment: one of [angry, frustrated, neutral, concerned, positive]
- keywords: array of up to 5 relevant keywords
- suggestedDepartment: the department name this should be routed to
- isFake: boolean - true if the complaint seems fake, frivolous, or spam
- fakeProbability: 0-1 float indicating likelihood of being fake
- duplicateSuggestion: null or a short description if this sounds like a common duplicate issue
- summary: a one-line summary of the complaint
- recommendedAction: one of ["inspect", "repair", "replace", "clean", "investigate", "escalate"]
- estimatedResolutionHours: estimated hours to resolve
- severityScore: 0-100 severity of the issue
- affectedPopulation: estimated number of people affected (small: <50, medium: 50-500, large: 500+)
- infrastructureRisk: one of ["none", "minor", "moderate", "major", "critical"] - risk to public infrastructure

Complaint details:
Service: ${service || "Not specified"}
Category: ${category || "Not specified"}
Location: ${locationAddress || "Not specified"}
Description: ${description}

Respond ONLY with valid JSON, no markdown.`;

      let analysis: any;
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 600,
        });

        const content = response.choices[0]?.message?.content || "{}";
        analysis = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      } catch (aiErr) {
        analysis = {
          category: category || "other",
          urgency: "medium",
          priorityScore: 50,
          sentiment: "neutral",
          keywords: [],
          suggestedDepartment: "General Administration",
          isFake: false,
          fakeProbability: 0,
          duplicateSuggestion: null,
          summary: description.substring(0, 100),
          recommendedAction: "inspect",
          estimatedResolutionHours: 48,
          severityScore: 50,
          affectedPopulation: "medium",
          infrastructureRisk: "minor",
        };
      }

      const aiCat = categoryMap[analysis.category] || analysis.category || "General Administration";
      const aiDept = departmentForCategory[aiCat] || analysis.suggestedDepartment || "General Administration";

      if (complaintId) {
        const existing = await db.select().from(aiAnalysis).where(eq(aiAnalysis.complaintId, complaintId)).limit(1);
        if (existing.length > 0) {
          await db.update(aiAnalysis).set({
            aiCategory: aiCat, aiDepartment: aiDept,
            aiUrgency: analysis.urgency, aiPriorityScore: analysis.priorityScore || 50,
            fraudScore: String(analysis.fakeProbability || 0),
            sentiment: analysis.sentiment, keywords: JSON.stringify(analysis.keywords || []),
          }).where(eq(aiAnalysis.complaintId, complaintId));
        } else {
          await db.insert(aiAnalysis).values({
            complaintId, aiCategory: aiCat, aiDepartment: aiDept,
            aiUrgency: analysis.urgency, aiPriorityScore: analysis.priorityScore || 50,
            fraudScore: String(analysis.fakeProbability || 0),
            sentiment: analysis.sentiment, keywords: JSON.stringify(analysis.keywords || []),
            duplicateOf: analysis.duplicateSuggestion || null,
          });
        }
      }

      res.json({
        success: true,
        analysis: {
          ...analysis,
          aiCategory: aiCat,
          aiDepartment: aiDept,
        },
      });
    } catch (error: any) {
      console.error("AI analysis error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/ai/check-duplicate", async (req: Request, res: Response) => {
    try {
      const { description, category, latitude, longitude } = req.body;

      const recentComplaints = await db.select({
        complaintId: complaints.complaintId,
        description: complaints.description,
        category: complaints.category,
        status: complaints.status,
        latitude: complaints.latitude,
        longitude: complaints.longitude,
        locationAddress: complaints.locationAddress,
        createdAt: complaints.createdAt,
      }).from(complaints)
        .where(sql`${complaints.createdAt} > NOW() - INTERVAL '30 days'`)
        .orderBy(desc(complaints.createdAt))
        .limit(50);

      if (recentComplaints.length === 0) {
        return res.json({ success: true, isDuplicate: false, matches: [] });
      }

      const prompt = `Given a new complaint and a list of recent complaints, identify potential duplicates.

New complaint:
Description: ${description}
Category: ${category || "Not specified"}
${latitude ? `Location: ${latitude}, ${longitude}` : ""}

Recent complaints (JSON):
${JSON.stringify(recentComplaints.slice(0, 20).map(c => ({
        id: c.complaintId, desc: c.description.substring(0, 150),
        cat: c.category, status: c.status, loc: c.locationAddress,
      })), null, 0)}

Respond with JSON only:
{
  "isDuplicate": boolean,
  "matches": [{"complaintId": string, "similarity": number (0-1), "reason": string}],
  "confidence": number (0-1)
}`;

      let result: any;
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 400,
        });
        const content = response.choices[0]?.message?.content || "{}";
        result = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      } catch {
        result = { isDuplicate: false, matches: [], confidence: 0 };
      }

      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/ai/voice-to-complaint", async (req: Request, res: Response) => {
    try {
      const { transcript } = req.body;
      if (!transcript) {
        return res.status(400).json({ success: false, message: "Transcript required" });
      }

      const prompt = `Convert this voice transcript into a structured complaint form. The speaker is a citizen reporting an issue to the municipal corporation.

Transcript: "${transcript}"

Respond with JSON only:
{
  "service": one of ["electricity", "gas", "water", "waste", "infrastructure", "other"],
  "category": a short category name,
  "description": a cleaned-up, clear description of the complaint,
  "urgency": one of ["low", "medium", "high"],
  "locationHint": any location mentioned or null
}`;

      let result: any;
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 300,
        });
        const content = response.choices[0]?.message?.content || "{}";
        result = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      } catch {
        result = {
          service: "other", category: "General",
          description: transcript, urgency: "medium", locationHint: null,
        };
      }

      res.json({ success: true, complaint: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/ai/complaint-insights", async (req: Request, res: Response) => {
    try {
      const analyses = await db.select().from(aiAnalysis).orderBy(desc(aiAnalysis.createdAt)).limit(200);

      const categoryBreakdown: Record<string, number> = {};
      const sentimentBreakdown: Record<string, number> = {};
      const urgencyBreakdown: Record<string, number> = {};
      const departmentBreakdown: Record<string, number> = {};
      let totalPriority = 0;
      let fakeCount = 0;
      const priorityDistribution = { critical: 0, high: 0, medium: 0, low: 0 };

      analyses.forEach(a => {
        if (a.aiCategory) categoryBreakdown[a.aiCategory] = (categoryBreakdown[a.aiCategory] || 0) + 1;
        if (a.sentiment) sentimentBreakdown[a.sentiment] = (sentimentBreakdown[a.sentiment] || 0) + 1;
        if (a.aiUrgency) {
          urgencyBreakdown[a.aiUrgency] = (urgencyBreakdown[a.aiUrgency] || 0) + 1;
          if (a.aiUrgency in priorityDistribution) priorityDistribution[a.aiUrgency as keyof typeof priorityDistribution]++;
        }
        if (a.aiDepartment) departmentBreakdown[a.aiDepartment] = (departmentBreakdown[a.aiDepartment] || 0) + 1;
        totalPriority += a.aiPriorityScore || 0;
        if (a.fraudScore && parseFloat(a.fraudScore) > 0.7) fakeCount++;
      });

      const trendData = await db.select({
        date: sql<string>`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      }).from(complaints)
        .where(sql`${complaints.createdAt} > NOW() - INTERVAL '30 days'`)
        .groupBy(sql`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`);

      const resolutionStats = await db.select({
        avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${complaints.updatedAt} - ${complaints.createdAt})) / 86400), 0)::numeric(10,1)`,
      }).from(complaints)
        .where(or(eq(complaints.status, "resolved"), eq(complaints.status, "closed")));

      const departmentEfficiency = await db.select({
        department: complaints.assignedTo,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
        avgResolution: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${complaints.updatedAt} - ${complaints.createdAt})) / 86400) FILTER (WHERE ${complaints.status} IN ('resolved','closed')), 0)::numeric(10,1)`,
        slaBreached: sql<number>`count(*) FILTER (WHERE ${complaints.slaDeadline} < NOW() AND ${complaints.status} NOT IN ('resolved','closed'))::int`,
      }).from(complaints)
        .where(sql`${complaints.assignedTo} IS NOT NULL`)
        .groupBy(complaints.assignedTo);

      res.json({
        success: true,
        insights: {
          totalAnalyzed: analyses.length,
          avgPriorityScore: analyses.length > 0 ? Math.round(totalPriority / analyses.length) : 0,
          suspectedFake: fakeCount,
          categoryBreakdown,
          sentimentBreakdown,
          urgencyBreakdown,
          departmentBreakdown,
          priorityDistribution,
          avgResolutionDays: resolutionStats[0]?.avgDays || 0,
          trendData,
          departmentEfficiency,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/ai/cluster-complaints", async (req: Request, res: Response) => {
    try {
      const allComplaints = await db.select({
        complaintId: complaints.complaintId,
        category: complaints.category,
        description: complaints.description,
        latitude: complaints.latitude,
        longitude: complaints.longitude,
        locationAddress: complaints.locationAddress,
        status: complaints.status,
        urgency: complaints.urgency,
      }).from(complaints)
        .where(and(
          sql`${complaints.createdAt} > NOW() - INTERVAL '60 days'`,
          ne(complaints.status, "resolved"),
          ne(complaints.status, "closed"),
        ))
        .orderBy(desc(complaints.createdAt))
        .limit(100);

      if (allComplaints.length < 3) {
        return res.json({ success: true, clusters: [], message: "Not enough complaints to cluster" });
      }

      const prompt = `Analyze these complaints and group them into clusters of related issues. Each cluster should represent a common infrastructure problem in a specific area.

Complaints (JSON):
${JSON.stringify(allComplaints.slice(0, 40).map(c => ({
        id: c.complaintId,
        cat: c.category,
        desc: c.description.substring(0, 120),
        loc: c.locationAddress || "Unknown",
        lat: c.latitude,
        lng: c.longitude,
        urgency: c.urgency,
      })), null, 0)}

Respond with JSON only. Create 2-8 clusters:
{
  "clusters": [
    {
      "name": "short cluster name",
      "category": "Infrastructure - Roads" (or other standard category),
      "area": "area/ward name",
      "complaintIds": ["id1", "id2"],
      "priorityScore": 1-100,
      "description": "brief cluster description",
      "recommendedAction": "what should be done",
      "estimatedAffected": number of people estimated affected
    }
  ]
}`;

      let result: any;
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1000,
        });
        const content = response.choices[0]?.message?.content || "{}";
        result = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      } catch {
        result = { clusters: [] };
      }

      for (const cluster of (result.clusters || [])) {
        const clusterId = `CLU-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
        const matchingComplaints = allComplaints.filter(c => cluster.complaintIds?.includes(c.complaintId));
        const avgLat = matchingComplaints.reduce((s, c) => s + (c.latitude || 0), 0) / (matchingComplaints.length || 1);
        const avgLng = matchingComplaints.reduce((s, c) => s + (c.longitude || 0), 0) / (matchingComplaints.length || 1);

        try {
          await db.insert(complaintClusters).values({
            clusterId,
            category: cluster.category || "General",
            area: cluster.area || "Unknown",
            latitude: avgLat || null,
            longitude: avgLng || null,
            complaintCount: cluster.complaintIds?.length || 0,
            priorityScore: cluster.priorityScore || 50,
            status: "active",
          });

          for (const cId of (cluster.complaintIds || [])) {
            await db.insert(complaintClusterLinks).values({
              complaintId: cId,
              clusterId,
              similarity: "0.85",
            });
          }
        } catch (e) {}

        cluster.clusterId = clusterId;
      }

      res.json({ success: true, clusters: result.clusters || [] });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/ai/hotspots", async (req: Request, res: Response) => {
    try {
      const hotspots = await db.select({
        area: complaints.locationAddress,
        category: complaints.category,
        count: sql<number>`count(*)::int`,
        avgUrgency: sql<string>`MODE() WITHIN GROUP (ORDER BY ${complaints.urgency})`,
        avgLat: sql<number>`AVG(${complaints.latitude})`,
        avgLng: sql<number>`AVG(${complaints.longitude})`,
        openCount: sql<number>`count(*) FILTER (WHERE ${complaints.status} NOT IN ('resolved','closed'))::int`,
      }).from(complaints)
        .where(and(
          sql`${complaints.createdAt} > NOW() - INTERVAL '90 days'`,
          sql`${complaints.locationAddress} IS NOT NULL`,
        ))
        .groupBy(complaints.locationAddress, complaints.category)
        .having(sql`count(*) >= 2`)
        .orderBy(sql`count(*) DESC`)
        .limit(20);

      const wardStats = await db.select({
        ward: sql<string>`COALESCE(${complaints.locationAddress}, 'Unknown')`,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
        pending: sql<number>`count(*) FILTER (WHERE ${complaints.status} NOT IN ('resolved','closed'))::int`,
        critical: sql<number>`count(*) FILTER (WHERE ${complaints.urgency} = 'critical')::int`,
        high: sql<number>`count(*) FILTER (WHERE ${complaints.urgency} = 'high')::int`,
      }).from(complaints)
        .where(sql`${complaints.locationAddress} IS NOT NULL`)
        .groupBy(sql`COALESCE(${complaints.locationAddress}, 'Unknown')`)
        .orderBy(sql`count(*) DESC`)
        .limit(15);

      const clusters = await db.select().from(complaintClusters)
        .where(eq(complaintClusters.status, "active"))
        .orderBy(desc(complaintClusters.priorityScore));

      res.json({ success: true, hotspots, wardStats, clusters });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/ai/staff-workload", async (req: Request, res: Response) => {
    try {
      const staffList = await db.select().from(staffProfiles).where(eq(staffProfiles.active, true));
      const workload = await Promise.all(staffList.map(async (staff) => {
        const [active] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
          .where(and(eq(complaints.assignedTo, staff.department), ne(complaints.status, "resolved"), ne(complaints.status, "closed")));
        const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
          .where(eq(complaints.assignedTo, staff.department));
        const [resolved] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
          .where(and(eq(complaints.assignedTo, staff.department), or(eq(complaints.status, "resolved"), eq(complaints.status, "closed"))));
        const [slaBreached] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
          .where(and(eq(complaints.assignedTo, staff.department), ne(complaints.status, "resolved"), sql`${complaints.slaDeadline} < NOW()`));
        const [user] = await db.select().from(users).where(eq(users.id, staff.userId)).limit(1);
        
        const resolutionRate = total?.count > 0 ? Math.round(((resolved?.count || 0) / total.count) * 100) : 0;
        const loadScore = Math.min(100, (active?.count || 0) * 15);
        
        return {
          ...staff,
          userName: user?.name || "Unknown",
          activeComplaints: active?.count || 0,
          totalHandled: total?.count || 0,
          resolved: resolved?.count || 0,
          slaBreached: slaBreached?.count || 0,
          resolutionRate,
          loadScore,
          recommendation: loadScore > 75 ? "Overloaded - redistribute" : loadScore > 50 ? "High load" : "Normal",
        };
      }));

      res.json({ success: true, workload: workload.sort((a, b) => b.loadScore - a.loadScore) });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/ai/contractor-intelligence", async (req: Request, res: Response) => {
    try {
      const contractors = await db.select().from(contractorProfiles).where(eq(contractorProfiles.active, true));
      const intelligence = await Promise.all(contractors.map(async (c) => {
        const allWO = await db.select().from(workOrders).where(eq(workOrders.assignedContractorId, c.userId));
        const [user] = await db.select().from(users).where(eq(users.id, c.userId)).limit(1);
        
        const active = allWO.filter(w => !["completed", "approved"].includes(w.status));
        const completed = allWO.filter(w => ["completed", "approved"].includes(w.status));
        const totalEstCost = allWO.reduce((s, w) => s + parseFloat(w.estimatedCost || "0"), 0);
        const totalActCost = allWO.reduce((s, w) => s + parseFloat(w.actualCost || "0"), 0);
        const costDeviation = totalEstCost > 0 ? Math.round(((totalActCost - totalEstCost) / totalEstCost) * 100) : 0;
        
        const onTimeCount = completed.filter(w => {
          if (!w.expectedCompletion || !w.completedAt) return true;
          return new Date(w.completedAt) <= new Date(w.expectedCompletion);
        }).length;
        
        const slaAdherence = completed.length > 0 ? Math.round((onTimeCount / completed.length) * 100) : 100;
        const avgProgress = active.length > 0 
          ? Math.round(active.reduce((s, w) => s + (w.progressPercent || 0), 0) / active.length) 
          : 0;

        const delayedWorks = active.filter(w => {
          if (!w.expectedCompletion) return false;
          return new Date() > new Date(w.expectedCompletion);
        });

        return {
          ...c,
          userName: user?.name || "Unknown",
          activeWorks: active.length,
          completedWorks: completed.length,
          totalWorks: allWO.length,
          totalEstimatedCost: totalEstCost,
          totalActualCost: totalActCost,
          costDeviation,
          slaAdherence,
          avgProgress,
          delayedWorks: delayedWorks.length,
          delayRisk: delayedWorks.length > 0 ? "high" : avgProgress < 30 && active.length > 0 ? "medium" : "low",
          performanceScore: Math.min(100, Math.round((slaAdherence * 0.4) + ((100 - Math.abs(costDeviation)) * 0.3) + ((completed.length * 10) * 0.3))),
        };
      }));

      res.json({ success: true, contractors: intelligence.sort((a, b) => b.performanceScore - a.performanceScore) });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/ai/sla-predictions", async (req: Request, res: Response) => {
    try {
      const activeComplaints = await db.select().from(complaints)
        .where(and(ne(complaints.status, "resolved"), ne(complaints.status, "closed")))
        .orderBy(desc(complaints.createdAt))
        .limit(50);

      const predictions = activeComplaints.map(c => {
        const createdAt = new Date(c.createdAt);
        const now = new Date();
        const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        const slaHours = SLA_HOURS[c.urgency] || 72;
        const slaDeadline = c.slaDeadline ? new Date(c.slaDeadline) : new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
        const hoursRemaining = (slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        const breached = hoursRemaining < 0;

        return {
          complaintId: c.complaintId,
          category: c.category,
          urgency: c.urgency,
          status: c.status,
          hoursElapsed: Math.round(hoursElapsed),
          hoursRemaining: Math.round(hoursRemaining),
          slaDeadline: slaDeadline.toISOString(),
          breached,
          riskLevel: breached ? "breached" : hoursRemaining < slaHours * 0.25 ? "critical" : hoursRemaining < slaHours * 0.5 ? "warning" : "safe",
          description: c.description?.substring(0, 100),
          locationAddress: c.locationAddress,
        };
      });

      const summary = {
        total: predictions.length,
        breached: predictions.filter(p => p.breached).length,
        critical: predictions.filter(p => p.riskLevel === "critical").length,
        warning: predictions.filter(p => p.riskLevel === "warning").length,
        safe: predictions.filter(p => p.riskLevel === "safe").length,
      };

      res.json({ success: true, predictions, summary });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/ai/analytics-overview", async (req: Request, res: Response) => {
    try {
      const trendData = await db.select({
        date: sql<string>`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
      }).from(complaints)
        .where(sql`${complaints.createdAt} > NOW() - INTERVAL '30 days'`)
        .groupBy(sql`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`);

      const categoryTrend = await db.select({
        category: complaints.category,
        count: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
        avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${complaints.updatedAt} - ${complaints.createdAt})) / 86400) FILTER (WHERE ${complaints.status} IN ('resolved','closed')), 0)::numeric(10,1)`,
      }).from(complaints)
        .groupBy(complaints.category)
        .orderBy(sql`count(*) DESC`)
        .limit(10);

      const statusDistribution = await db.select({
        status: complaints.status,
        count: sql<number>`count(*)::int`,
      }).from(complaints).groupBy(complaints.status);

      const urgencyVsResolution = await db.select({
        urgency: complaints.urgency,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
        avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${complaints.updatedAt} - ${complaints.createdAt})) / 86400) FILTER (WHERE ${complaints.status} IN ('resolved','closed')), 0)::numeric(10,1)`,
      }).from(complaints).groupBy(complaints.urgency);

      const monthlyTrend = await db.select({
        month: sql<string>`TO_CHAR(${complaints.createdAt}, 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
      }).from(complaints)
        .groupBy(sql`TO_CHAR(${complaints.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${complaints.createdAt}, 'YYYY-MM')`)
        .limit(12);

      const workOrderStats = await db.select({
        status: workOrders.status,
        count: sql<number>`count(*)::int`,
        totalCost: sql<string>`COALESCE(SUM(${workOrders.estimatedCost}), 0)`,
        actualCost: sql<string>`COALESCE(SUM(${workOrders.actualCost}), 0)`,
      }).from(workOrders).groupBy(workOrders.status);

      res.json({
        success: true,
        analytics: {
          trendData,
          categoryTrend,
          statusDistribution,
          urgencyVsResolution,
          monthlyTrend,
          workOrderStats,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/ai/generate-ward-insights", async (req: Request, res: Response) => {
    try {
      const departmentStats = await db.select({
        department: complaints.assignedTo,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
        pending: sql<number>`count(*) FILTER (WHERE ${complaints.status} NOT IN ('resolved','closed'))::int`,
        critical: sql<number>`count(*) FILTER (WHERE ${complaints.urgency} = 'critical')::int`,
      }).from(complaints)
        .where(sql`${complaints.assignedTo} IS NOT NULL`)
        .groupBy(complaints.assignedTo);

      const woStats = await db.select({
        dept: workOrders.department,
        totalWO: sql<number>`count(*)::int`,
        totalBudget: sql<string>`COALESCE(SUM(${workOrders.estimatedCost}), 0)`,
        completedWO: sql<number>`count(*) FILTER (WHERE ${workOrders.status} IN ('completed','approved'))::int`,
      }).from(workOrders)
        .groupBy(workOrders.department);

      const summaryData = JSON.stringify({ departments: departmentStats.slice(0, 10), workOrders: woStats.slice(0, 10) });

      let insights: any;
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: `Analyze this governance data and provide actionable AI insights. Data: ${summaryData}. Respond with JSON: {"recommendations": [{"title": "short title", "description": "actionable insight", "priority": "high|medium|low", "type": "budget|staffing|process|infrastructure"}], "riskAreas": [{"area": "name", "risk": "description", "severity": "critical|high|medium"}], "budgetSuggestions": [{"department": "name", "suggestion": "what to do", "estimatedImpact": "description"}]}` }],
          temperature: 0.4,
          max_tokens: 800,
        });
        insights = JSON.parse((response.choices[0]?.message?.content || "{}").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
      } catch {
        insights = { recommendations: [], riskAreas: [], budgetSuggestions: [] };
      }

      res.json({ success: true, insights, departmentStats, woStats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
}
