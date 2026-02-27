// @ts-nocheck
import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  users, complaints, complaintTimeline, notifications, workOrders,
  workOrderResources, staffProfiles, contractorProfiles, complaintClusters,
  complaintClusterLinks, auditLogs, aiAnalysis, feedback, appointments,
  documents, emergencyLogs, announcements,
  indianStates, indianCities, indianWards, locationStaffAssignments,
} from "../shared/schema";
import { eq, desc, and, sql, count, avg, gte, lte, ne, or, inArray, ilike, asc } from "drizzle-orm";
import { seedIndianLocations } from "./seed-locations";

async function autoSeedRoles() {
  try {
    const existing = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(ne(users.role, "citizen"));
    if (existing[0]?.count > 0) {
      console.log("[Seed] Role users already exist, skipping auto-seed.");
      return;
    }
    console.log("[Seed] No role users found, auto-seeding...");

    const departments = [
      "CSPDCL - Raipur Division", "Gas Authority - Chhattisgarh", "PHE Department - Raipur",
      "Municipal Corp - Sanitation Dept", "Municipal Corp - Engineering Dept", "General Administration",
    ];
    const specializations = ["Road & Bridges", "Drainage & Sewage", "Electrical Works", "Water Supply", "Building Construction", "Landscaping"];

    for (let i = 0; i < 6; i++) {
      const [staffUser] = await db.insert(users).values({
        username: `staff${i + 1}`, password: `staff${i + 1}`, name: `Staff Member ${i + 1}`,
        phone: `900000000${i}`, role: "staff", suvidhaId: `STF-2025-${1000 + i}A`,
      }).returning();
      await db.insert(staffProfiles).values({
        userId: staffUser.id, department: departments[i], designation: "Field Officer",
        employeeId: `EMP-${1000 + i}`, ward: `Ward ${i + 1}`, phone: `900000000${i}`,
      });
    }

    for (let i = 0; i < 4; i++) {
      const [contractorUser] = await db.insert(users).values({
        username: `contractor${i + 1}`, password: `contractor${i + 1}`, name: `Contractor ${i + 1}`,
        phone: `800000000${i}`, role: "contractor", suvidhaId: `CNT-2025-${2000 + i}A`,
      }).returning();
      await db.insert(contractorProfiles).values({
        userId: contractorUser.id, companyName: `${["Raipur", "CG", "Bharat", "Mega"][i]} Construction`,
        contractorId: `CON-${2000 + i}`, specialization: specializations[i],
        licenseNumber: `LIC-CG-${3000 + i}`, phone: `800000000${i}`,
      });
    }

    const authorityDepartments = [
      { dept: "CSPDCL - Raipur Division", name: "Electricity Authority", username: "authority1", phone: "7000000000" },
      { dept: "Gas Authority - Chhattisgarh", name: "Gas Authority", username: "authority2", phone: "7000000002" },
      { dept: "PHE Department - Raipur", name: "Water Authority", username: "authority3", phone: "7000000003" },
      { dept: "Municipal Corp - Sanitation Dept", name: "Sanitation Authority", username: "authority4", phone: "7000000004" },
      { dept: "Municipal Corp - Engineering Dept", name: "Municipal Authority", username: "authority5", phone: "7000000005" },
    ];

    for (const ad of authorityDepartments) {
      const [authUser] = await db.insert(users).values({
        username: ad.username, password: ad.username, name: ad.name,
        phone: ad.phone, role: "authority", suvidhaId: `AUTH-2025-${5000 + authorityDepartments.indexOf(ad)}A`,
      }).returning();
      await db.insert(staffProfiles).values({
        userId: authUser.id, department: ad.dept, designation: "Department Head",
        employeeId: `DH-${5000 + authorityDepartments.indexOf(ad)}`, ward: "All Wards", phone: ad.phone,
      });
    }

    await db.insert(users).values({
      username: "head1", password: "head1", name: "District Collector",
      phone: "7000000001", role: "head", suvidhaId: "HEAD-2025-9500A",
    });

    await db.insert(users).values({
      username: "admin", password: "admin123", name: "System Administrator",
      phone: "7000000009", role: "admin", suvidhaId: "ADM-2025-9000A",
    });

    console.log("[Seed] Role users seeded successfully.");
  } catch (err: any) {
    console.error("[Seed] Auto-seed error:", err.message);
  }
}

import crypto from "crypto";

function generateWorkOrderId(): string {
  return `WO-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  submitted: ["in_progress", "escalated", "rejected"],
  in_progress: ["resolved", "escalated", "work_ordered"],
  escalated: ["work_ordered", "in_progress"],
  work_ordered: ["in_progress", "completed"],
  completed: ["approved", "in_progress"],
  approved: [],
  resolved: ["closed"],
  closed: [],
  rejected: [],
};

interface RoleSession {
  userId: string;
  role: string;
  name: string;
  expiresAt: number;
}

const roleSessions = new Map<string, RoleSession>();

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of roleSessions) {
    if (session.expiresAt < now) roleSessions.delete(token);
  }
}, 60000);

function createRoleToken(userId: string, role: string, name: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  roleSessions.set(token, { userId, role, name, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  return token;
}

function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const token = authHeader.slice(7);
    const session = roleSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (session) roleSessions.delete(token);
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
    if (!allowedRoles.includes(session.role)) {
      return res.status(403).json({ success: false, message: "Insufficient permissions" });
    }
    (req as any).roleUser = session;
    next();
  };
}

export function registerGovernanceRoutes(app: Express): void {

  autoSeedRoles();
  seedIndianLocations().then(r => console.log("[Seed]", r.message)).catch(e => console.error("[Seed Locations]", e.message));

  // ==================== LOCATION LOOKUP APIs ====================

  app.get("/api/locations/states", async (_req: Request, res: Response) => {
    try {
      const states = await db.select().from(indianStates).orderBy(asc(indianStates.name));
      res.json({ success: true, states });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/locations/cities", async (req: Request, res: Response) => {
    try {
      const { stateId } = req.query;
      let query = db.select({
        id: indianCities.id,
        name: indianCities.name,
        stateId: indianCities.stateId,
        district: indianCities.district,
        latitude: indianCities.latitude,
        longitude: indianCities.longitude,
        stateName: indianStates.name,
        stateCode: indianStates.code,
      }).from(indianCities)
        .leftJoin(indianStates, eq(indianCities.stateId, indianStates.id))
        .orderBy(asc(indianCities.name));

      if (stateId) {
        query = query.where(eq(indianCities.stateId, parseInt(stateId as string)));
      }
      const cities = await query;
      res.json({ success: true, cities });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/locations/wards", async (req: Request, res: Response) => {
    try {
      const { cityId } = req.query;
      if (!cityId) return res.status(400).json({ success: false, message: "cityId required" });

      const wards = await db.select({
        id: indianWards.id,
        name: indianWards.name,
        wardNumber: indianWards.wardNumber,
        cityId: indianWards.cityId,
        latitude: indianWards.latitude,
        longitude: indianWards.longitude,
      }).from(indianWards)
        .where(eq(indianWards.cityId, parseInt(cityId as string)))
        .orderBy(asc(indianWards.wardNumber));

      res.json({ success: true, wards });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/locations/resolve", async (req: Request, res: Response) => {
    try {
      const { lat, lng, address, ward: wardName, city: cityName, state: stateName } = req.query;

      let resolvedState: any = null;
      let resolvedCity: any = null;
      let resolvedWard: any = null;

      if (stateName) {
        const stateQuery = await db.select().from(indianStates)
          .where(ilike(indianStates.name, `%${stateName}%`)).limit(1);
        if (stateQuery.length > 0) resolvedState = stateQuery[0];
      }

      if (cityName) {
        let cityQuery = db.select({
          id: indianCities.id,
          name: indianCities.name,
          stateId: indianCities.stateId,
          district: indianCities.district,
          latitude: indianCities.latitude,
          longitude: indianCities.longitude,
        }).from(indianCities)
          .where(ilike(indianCities.name, `%${cityName}%`));

        if (resolvedState) {
          cityQuery = cityQuery.where(and(
            ilike(indianCities.name, `%${cityName}%`),
            eq(indianCities.stateId, resolvedState.id)
          ));
        }
        const cityResults = await cityQuery.limit(1);
        if (cityResults.length > 0) {
          resolvedCity = cityResults[0];
          if (!resolvedState) {
            const [st] = await db.select().from(indianStates).where(eq(indianStates.id, resolvedCity.stateId));
            resolvedState = st;
          }
        }
      }

      if (lat && lng && !resolvedCity) {
        const latNum = parseFloat(lat as string);
        const lngNum = parseFloat(lng as string);
        const nearestCities = await db.select({
          id: indianCities.id,
          name: indianCities.name,
          stateId: indianCities.stateId,
          district: indianCities.district,
          latitude: indianCities.latitude,
          longitude: indianCities.longitude,
        }).from(indianCities)
          .orderBy(sql`(${indianCities.latitude} - ${latNum})^2 + (${indianCities.longitude} - ${lngNum})^2`)
          .limit(1);

        if (nearestCities.length > 0) {
          const dist = Math.sqrt(
            Math.pow((nearestCities[0].latitude || 0) - latNum, 2) +
            Math.pow((nearestCities[0].longitude || 0) - lngNum, 2)
          );
          if (dist < 1.0) {
            resolvedCity = nearestCities[0];
            const [st] = await db.select().from(indianStates).where(eq(indianStates.id, resolvedCity.stateId));
            resolvedState = st;
          }
        }
      }

      if (resolvedCity && wardName) {
        const wardResults = await db.select().from(indianWards)
          .where(and(
            eq(indianWards.cityId, resolvedCity.id),
            ilike(indianWards.name, `%${wardName}%`)
          )).limit(1);
        if (wardResults.length > 0) resolvedWard = wardResults[0];
      }

      if (resolvedCity && !resolvedWard && lat && lng) {
        const latNum = parseFloat(lat as string);
        const lngNum = parseFloat(lng as string);
        const nearestWards = await db.select().from(indianWards)
          .where(eq(indianWards.cityId, resolvedCity.id))
          .orderBy(sql`(${indianWards.latitude} - ${latNum})^2 + (${indianWards.longitude} - ${lngNum})^2`)
          .limit(1);
        if (nearestWards.length > 0) resolvedWard = nearestWards[0];
      }

      const assignedStaff = resolvedWard ? await db.select({
        userId: locationStaffAssignments.userId,
        roleType: locationStaffAssignments.roleType,
        department: locationStaffAssignments.department,
      }).from(locationStaffAssignments)
        .where(and(
          eq(locationStaffAssignments.wardId, resolvedWard.id),
          eq(locationStaffAssignments.active, true)
        )) : [];

      res.json({
        success: true,
        state: resolvedState ? { id: resolvedState.id, name: resolvedState.name, code: resolvedState.code } : null,
        city: resolvedCity ? { id: resolvedCity.id, name: resolvedCity.name, district: resolvedCity.district } : null,
        ward: resolvedWard ? { id: resolvedWard.id, name: resolvedWard.name, wardNumber: resolvedWard.wardNumber } : null,
        assignedStaff,
      });
    } catch (e: any) {
      console.error("[Location Resolve]", e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== ROLE-BASED AUTH ====================

  app.post("/api/auth/role-login", async (req: Request, res: Response) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: "Username, password and role required" });
      }

      const [user] = await db.select().from(users)
        .where(and(eq(users.username, username), eq(users.role, role)))
        .limit(1);

      if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      let profile = null;
      if (role === "staff" || role === "authority") {
        [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, user.id)).limit(1);
      } else if (role === "contractor") {
        [profile] = await db.select().from(contractorProfiles).where(eq(contractorProfiles.userId, user.id)).limit(1);
      }

      await db.insert(auditLogs).values({
        userId: user.id, action: "login", entityType: "user", entityId: user.id,
        newValue: JSON.stringify({ role, timestamp: new Date().toISOString() }),
      });

      const token = createRoleToken(user.id, user.role, user.name || username);

      res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role, suvidhaId: user.suvidhaId }, profile });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/auth/role-logout", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      roleSessions.delete(authHeader.slice(7));
    }
    res.json({ success: true });
  });

  // ==================== STAFF ROUTES ====================

  app.get("/api/staff/complaints", requireRole("staff", "authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { department, status, sortBy } = req.query;
      const sessionUser = (req as any).roleUser;
      
      let staffDept = department as string;
      if (sessionUser.role === "staff" && !staffDept) {
        const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, sessionUser.userId)).limit(1);
        if (profile) staffDept = profile.department;
      }

      let query = db.select().from(complaints);
      const conditions: any[] = [];
      if (staffDept) conditions.push(eq(complaints.assignedTo, staffDept));
      if (status && status !== "all") conditions.push(eq(complaints.status, status as string));

      const result = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(complaints.createdAt))
        : await query.orderBy(desc(complaints.createdAt));

      const enriched = await Promise.all(result.map(async (c) => {
        const timeline = await db.select().from(complaintTimeline)
          .where(eq(complaintTimeline.complaintId, c.complaintId))
          .orderBy(desc(complaintTimeline.createdAt));
        const [analysis] = await db.select().from(aiAnalysis)
          .where(eq(aiAnalysis.complaintId, c.complaintId)).limit(1);
        return { ...c, timeline, aiAnalysis: analysis || null };
      }));

      res.json({ success: true, complaints: enriched });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/staff/complaints/:complaintId/update", requireRole("staff", "authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { complaintId } = req.params;
      const { staffId, status, note, resolution } = req.body;

      const [existing] = await db.select().from(complaints).where(eq(complaints.complaintId, complaintId)).limit(1);
      if (!existing) return res.status(404).json({ success: false, message: "Complaint not found" });

      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, message: `Cannot transition from '${existing.status}' to '${status}'. Allowed: ${allowed.join(", ")}` });
      }

      const updateData: any = { status, updatedAt: new Date() };
      if (resolution) updateData.resolution = resolution;

      await db.update(complaints).set(updateData).where(eq(complaints.complaintId, complaintId));

      await db.insert(complaintTimeline).values({
        complaintId, status,
        note: note || `Status updated to ${status} by staff`,
      });

      const [complaint] = await db.select().from(complaints).where(eq(complaints.complaintId, complaintId)).limit(1);
      if (complaint?.userId) {
        await db.insert(notifications).values({
          userId: complaint.userId, type: "complaint",
          title: `Complaint ${status}`,
          message: `Your complaint ${complaintId} status has been updated to: ${status}. ${note || ""}`,
          read: false, actionLink: `/complaints/${complaintId}`,
        });
      }

      await db.insert(auditLogs).values({
        userId: staffId, action: "update_complaint", entityType: "complaint", entityId: complaintId,
        newValue: JSON.stringify({ status, note, resolution }),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/staff/complaints/:complaintId/escalate", requireRole("staff", "authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { complaintId } = req.params;
      const { staffId, reason } = req.body;

      const [existing] = await db.select().from(complaints).where(eq(complaints.complaintId, complaintId)).limit(1);
      if (!existing) return res.status(404).json({ success: false, message: "Complaint not found" });

      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes("escalated")) {
        return res.status(400).json({ success: false, message: `Cannot escalate from '${existing.status}'. Allowed transitions: ${allowed.join(", ")}` });
      }

      await db.update(complaints).set({ status: "escalated", updatedAt: new Date() })
        .where(eq(complaints.complaintId, complaintId));

      await db.insert(complaintTimeline).values({
        complaintId, status: "escalated",
        note: `Escalated to contractor by staff. Reason: ${reason || "Requires specialized work"}`,
      });

      await db.insert(auditLogs).values({
        userId: staffId, action: "escalate_complaint", entityType: "complaint", entityId: complaintId,
        newValue: JSON.stringify({ reason }),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/staff/stats/:staffId", requireRole("staff", "authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { staffId } = req.params;
      const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, staffId)).limit(1);
      if (!profile) return res.status(404).json({ success: false, message: "Staff not found" });

      const [assigned] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
        .where(and(eq(complaints.assignedTo, profile.department), ne(complaints.status, "resolved"), ne(complaints.status, "closed")));

      const [resolved] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
        .where(and(eq(complaints.assignedTo, profile.department), or(eq(complaints.status, "resolved"), eq(complaints.status, "closed"))));

      const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
        .where(eq(complaints.assignedTo, profile.department));

      const [slaBreached] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
        .where(and(eq(complaints.assignedTo, profile.department), ne(complaints.status, "resolved"), ne(complaints.status, "closed"), sql`${complaints.slaDeadline} < NOW()`));

      res.json({
        success: true, profile, stats: {
          assigned: assigned?.count || 0, resolved: resolved?.count || 0,
          total: total?.count || 0, slaBreached: slaBreached?.count || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== CONTRACTOR ROUTES ====================

  app.get("/api/contractor/work-orders", requireRole("contractor", "authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const sessionUser = (req as any).roleUser;
      const conditions: any[] = [];
      if (sessionUser.role === "contractor") conditions.push(eq(workOrders.assignedContractorId, sessionUser.userId));
      if (sessionUser.role === "authority") {
        const dept = await getAuthorityDepartment(sessionUser.userId, sessionUser.role);
        if (dept) conditions.push(eq(workOrders.department, dept));
      }
      if (status && status !== "all") conditions.push(eq(workOrders.status, status as string));

      const result = conditions.length > 0
        ? await db.select().from(workOrders).where(and(...conditions)).orderBy(desc(workOrders.createdAt))
        : await db.select().from(workOrders).orderBy(desc(workOrders.createdAt));

      const enriched = await Promise.all(result.map(async (wo) => {
        const resources = await db.select().from(workOrderResources).where(eq(workOrderResources.workOrderId, wo.workOrderId));
        return { ...wo, resources };
      }));

      res.json({ success: true, workOrders: enriched });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/contractor/work-orders/:workOrderId/progress", requireRole("contractor", "admin"), async (req: Request, res: Response) => {
    try {
      const { workOrderId } = req.params;
      const sessionUser = (req as any).roleUser;
      const { progressPercent, notes, beforePhoto, afterPhoto, actualCost } = req.body;

      if (sessionUser.role === "contractor") {
        const [wo] = await db.select().from(workOrders).where(eq(workOrders.workOrderId, workOrderId)).limit(1);
        if (!wo || wo.assignedContractorId !== sessionUser.userId) {
          return res.status(403).json({ success: false, message: "Not authorized to update this work order" });
        }
      }

      const updateData: any = { progressPercent, updatedAt: new Date() };
      if (notes) updateData.notes = notes;
      if (beforePhoto) updateData.beforePhoto = beforePhoto;
      if (afterPhoto) updateData.afterPhoto = afterPhoto;
      if (actualCost) updateData.actualCost = actualCost;
      if (progressPercent >= 100) {
        updateData.status = "completed";
        updateData.completedAt = new Date();
      } else if (progressPercent > 0) {
        updateData.status = "in_progress";
      }

      await db.update(workOrders).set(updateData).where(eq(workOrders.workOrderId, workOrderId));

      await db.insert(auditLogs).values({
        userId: sessionUser.userId, action: "update_work_progress", entityType: "work_order", entityId: workOrderId,
        newValue: JSON.stringify({ progressPercent, notes }),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/contractor/work-orders/:workOrderId/resources", requireRole("contractor", "admin"), async (req: Request, res: Response) => {
    try {
      const { workOrderId } = req.params;
      const { resourceType, name, quantity, unit, cost } = req.body;

      const [resource] = await db.insert(workOrderResources).values({
        workOrderId, resourceType, name, quantity: quantity || null, unit: unit || null, cost: cost || null,
      }).returning();

      res.json({ success: true, resource });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/contractor/stats/:contractorId", requireRole("contractor", "authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { contractorId } = req.params;
      const [profile] = await db.select().from(contractorProfiles).where(eq(contractorProfiles.userId, contractorId)).limit(1);
      if (!profile) return res.status(404).json({ success: false, message: "Contractor not found" });

      const [active] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders)
        .where(and(eq(workOrders.assignedContractorId, contractorId), ne(workOrders.status, "completed"), ne(workOrders.status, "approved")));

      const [completed] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders)
        .where(and(eq(workOrders.assignedContractorId, contractorId), or(eq(workOrders.status, "completed"), eq(workOrders.status, "approved"))));

      const [totalCost] = await db.select({ total: sql<string>`COALESCE(SUM(${workOrders.actualCost}), 0)` }).from(workOrders)
        .where(eq(workOrders.assignedContractorId, contractorId));

      res.json({
        success: true, profile, stats: {
          activeWorks: active?.count || 0, completedWorks: completed?.count || 0,
          totalCost: totalCost?.total || "0",
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== AUTHORITY ROUTES ====================

  async function getAuthorityDepartment(userId: string, role: string): Promise<string | null> {
    if (role === "head" || role === "admin") return null;
    const [profile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId)).limit(1);
    return profile?.department || null;
  }

  app.get("/api/authority/dashboard", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const sessionUser = (req as any).roleUser;
      const dept = await getAuthorityDepartment(sessionUser.userId, sessionUser.role);
      const deptFilter = dept ? eq(complaints.assignedTo, dept) : undefined;
      const woDeptFilter = dept ? eq(workOrders.department, dept) : undefined;

      const [totalComplaints] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints).where(deptFilter ? deptFilter : undefined);
      const [activeComplaints] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
        .where(deptFilter ? and(ne(complaints.status, "resolved"), ne(complaints.status, "closed"), deptFilter) : and(ne(complaints.status, "resolved"), ne(complaints.status, "closed")));
      const [resolvedComplaints] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
        .where(deptFilter ? and(or(eq(complaints.status, "resolved"), eq(complaints.status, "closed")), deptFilter) : or(eq(complaints.status, "resolved"), eq(complaints.status, "closed")));
      const [slaBreached] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
        .where(deptFilter ? and(ne(complaints.status, "resolved"), ne(complaints.status, "closed"), sql`${complaints.slaDeadline} < NOW()`, deptFilter) : and(ne(complaints.status, "resolved"), ne(complaints.status, "closed"), sql`${complaints.slaDeadline} < NOW()`));
      const [totalWorkOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders).where(woDeptFilter ? woDeptFilter : undefined);
      const [activeWorkOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders)
        .where(woDeptFilter ? and(ne(workOrders.status, "completed"), ne(workOrders.status, "approved"), woDeptFilter) : and(ne(workOrders.status, "completed"), ne(workOrders.status, "approved")));
      const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "citizen"));
      const [totalStaff] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "staff"));
      const [totalContractors] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "contractor"));

      const departmentStats = deptFilter
        ? await db.select({
            department: complaints.assignedTo,
            total: sql<number>`count(*)::int`,
            resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
            active: sql<number>`count(*) FILTER (WHERE ${complaints.status} NOT IN ('resolved','closed'))::int`,
          }).from(complaints).where(deptFilter).groupBy(complaints.assignedTo)
        : await db.select({
            department: complaints.assignedTo,
            total: sql<number>`count(*)::int`,
            resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
            active: sql<number>`count(*) FILTER (WHERE ${complaints.status} NOT IN ('resolved','closed'))::int`,
          }).from(complaints).groupBy(complaints.assignedTo);

      const categoryStats = deptFilter
        ? await db.select({ category: complaints.category, count: sql<number>`count(*)::int` }).from(complaints).where(deptFilter).groupBy(complaints.category).orderBy(sql`count(*) DESC`).limit(10)
        : await db.select({ category: complaints.category, count: sql<number>`count(*)::int` }).from(complaints).groupBy(complaints.category).orderBy(sql`count(*) DESC`).limit(10);

      const recentComplaints = deptFilter
        ? await db.select().from(complaints).where(deptFilter).orderBy(desc(complaints.createdAt)).limit(10)
        : await db.select().from(complaints).orderBy(desc(complaints.createdAt)).limit(10);

      const urgencyStats = deptFilter
        ? await db.select({ urgency: complaints.urgency, count: sql<number>`count(*)::int` }).from(complaints).where(deptFilter).groupBy(complaints.urgency)
        : await db.select({ urgency: complaints.urgency, count: sql<number>`count(*)::int` }).from(complaints).groupBy(complaints.urgency);

      res.json({
        success: true,
        stats: {
          totalComplaints: totalComplaints?.count || 0,
          activeComplaints: activeComplaints?.count || 0,
          resolvedComplaints: resolvedComplaints?.count || 0,
          slaBreached: slaBreached?.count || 0,
          totalWorkOrders: totalWorkOrders?.count || 0,
          activeWorkOrders: activeWorkOrders?.count || 0,
          totalUsers: totalUsers?.count || 0,
          totalStaff: totalStaff?.count || 0,
          totalContractors: totalContractors?.count || 0,
          resolutionRate: totalComplaints?.count > 0 ? Math.round(((resolvedComplaints?.count || 0) / totalComplaints.count) * 100) : 0,
        },
        departmentStats,
        categoryStats,
        urgencyStats,
        recentComplaints,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/authority/complaints-map", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const mapComplaints = await db.select({
        id: complaints.id,
        complaintId: complaints.complaintId,
        category: complaints.category,
        status: complaints.status,
        urgency: complaints.urgency,
        latitude: complaints.latitude,
        longitude: complaints.longitude,
        locationAddress: complaints.locationAddress,
        description: complaints.description,
        createdAt: complaints.createdAt,
      }).from(complaints)
        .where(and(sql`${complaints.latitude} IS NOT NULL`, sql`${complaints.longitude} IS NOT NULL`));

      const clusters = await db.select().from(complaintClusters).where(eq(complaintClusters.status, "active"));

      const works = await db.select({
        id: workOrders.id,
        workOrderId: workOrders.workOrderId,
        title: workOrders.title,
        status: workOrders.status,
        latitude: workOrders.latitude,
        longitude: workOrders.longitude,
        progressPercent: workOrders.progressPercent,
      }).from(workOrders)
        .where(and(sql`${workOrders.latitude} IS NOT NULL`, sql`${workOrders.longitude} IS NOT NULL`));

      res.json({ success: true, complaints: mapComplaints, clusters, workOrders: works });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/authority/work-orders", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { title, description, department, category, priority, complaintId, clusterId,
        estimatedCost, assignedContractorId, assignedStaffId, latitude, longitude, locationAddress,
        expectedCompletion, createdBy } = req.body;

      const workOrderId = generateWorkOrderId();
      const [wo] = await db.insert(workOrders).values({
        workOrderId, title, description, department, category,
        priority: priority || "medium", status: "created",
        assignedStaffId: assignedStaffId || null, assignedContractorId: assignedContractorId || null,
        complaintId: complaintId || null, clusterId: clusterId || null,
        estimatedCost: estimatedCost || null,
        latitude: latitude || null, longitude: longitude || null,
        locationAddress: locationAddress || null,
        expectedCompletion: expectedCompletion ? new Date(expectedCompletion) : null,
      }).returning();

      if (complaintId) {
        await db.update(complaints).set({ status: "work_ordered", updatedAt: new Date() })
          .where(eq(complaints.complaintId, complaintId));
        await db.insert(complaintTimeline).values({
          complaintId, status: "work_ordered",
          note: `Work order ${workOrderId} created for this complaint`,
        });
      }

      await db.insert(auditLogs).values({
        userId: createdBy, action: "create_work_order", entityType: "work_order", entityId: workOrderId,
        newValue: JSON.stringify({ title, department, priority, assignedContractorId }),
      });

      res.json({ success: true, workOrder: wo });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/authority/work-orders/:workOrderId/approve", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { workOrderId } = req.params;
      const { approvedBy } = req.body;

      await db.update(workOrders).set({
        status: "approved", approvedBy, approvedAt: new Date(), updatedAt: new Date(),
      }).where(eq(workOrders.workOrderId, workOrderId));

      await db.insert(auditLogs).values({
        userId: approvedBy, action: "approve_work_order", entityType: "work_order", entityId: workOrderId,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/authority/staff-performance", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const sessionUser = (req as any).roleUser;
      const dept = await getAuthorityDepartment(sessionUser.userId, sessionUser.role);
      const staffList = dept
        ? await db.select().from(staffProfiles).where(and(eq(staffProfiles.active, true), eq(staffProfiles.department, dept)))
        : await db.select().from(staffProfiles).where(eq(staffProfiles.active, true));
      const performance = await Promise.all(staffList.map(async (staff) => {
        const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
          .where(eq(complaints.assignedTo, staff.department));
        const [resolved] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
          .where(and(eq(complaints.assignedTo, staff.department), or(eq(complaints.status, "resolved"), eq(complaints.status, "closed"))));
        const [user] = await db.select().from(users).where(eq(users.id, staff.userId)).limit(1);
        return {
          ...staff, userName: user?.name || "Unknown",
          totalComplaints: total?.count || 0, resolvedComplaints: resolved?.count || 0,
          resolutionRate: total?.count > 0 ? Math.round(((resolved?.count || 0) / total.count) * 100) : 0,
        };
      }));

      res.json({ success: true, staff: performance });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/authority/contractor-performance", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const contractors = await db.select().from(contractorProfiles).where(eq(contractorProfiles.active, true));
      const performance = await Promise.all(contractors.map(async (c) => {
        const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders)
          .where(eq(workOrders.assignedContractorId, c.userId));
        const [completed] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders)
          .where(and(eq(workOrders.assignedContractorId, c.userId), or(eq(workOrders.status, "completed"), eq(workOrders.status, "approved"))));
        const [user] = await db.select().from(users).where(eq(users.id, c.userId)).limit(1);
        return {
          ...c, userName: user?.name || "Unknown",
          totalWorks: total?.count || 0, completedWorks: completed?.count || 0,
          completionRate: total?.count > 0 ? Math.round(((completed?.count || 0) / total.count) * 100) : 0,
        };
      }));

      res.json({ success: true, contractors: performance });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== ADMIN ROUTES ====================

  app.get("/api/admin/users", requireRole("admin", "head"), async (req: Request, res: Response) => {
    try {
      const { role, search } = req.query;
      let allUsers;
      if (role && role !== "all") {
        allUsers = await db.select().from(users).where(eq(users.role, role as string)).orderBy(desc(users.createdAt));
      } else {
        allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      }

      if (search) {
        const s = (search as string).toLowerCase();
        allUsers = allUsers.filter(u => (u.name || "").toLowerCase().includes(s) || u.username.toLowerCase().includes(s) || (u.suvidhaId || "").toLowerCase().includes(s));
      }

      res.json({ success: true, users: allUsers.map(u => ({ ...u, password: undefined })) });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/admin/users/:userId/role", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { role, adminId } = req.body;

      if (!["citizen", "staff", "contractor", "authority", "head", "admin"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }

      const [oldUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      await db.update(users).set({ role }).where(eq(users.id, userId));

      await db.insert(auditLogs).values({
        userId: adminId, action: "change_role", entityType: "user", entityId: userId,
        oldValue: oldUser?.role, newValue: role,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/admin/staff", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { userId, department, designation, employeeId, ward, phone } = req.body;

      await db.update(users).set({ role: "staff" }).where(eq(users.id, userId));

      const [profile] = await db.insert(staffProfiles).values({
        userId, department, designation, employeeId, ward: ward || null, phone: phone || null,
      }).returning();

      res.json({ success: true, profile });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/admin/contractor", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { userId, companyName, contractorId, specialization, licenseNumber, phone } = req.body;

      await db.update(users).set({ role: "contractor" }).where(eq(users.id, userId));

      const [profile] = await db.insert(contractorProfiles).values({
        userId, companyName, contractorId, specialization, licenseNumber: licenseNumber || null, phone: phone || null,
      }).returning();

      res.json({ success: true, profile });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/admin/audit-logs", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { limit: lim } = req.query;
      const logs = await db.select().from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(parseInt(lim as string) || 100);

      const enriched = await Promise.all(logs.map(async (log) => {
        const [user] = log.userId ? await db.select().from(users).where(eq(users.id, log.userId)).limit(1) : [null];
        return { ...log, userName: user?.name || "System" };
      }));

      res.json({ success: true, logs: enriched });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/admin/system-stats", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      const roleCounts = await db.select({
        role: users.role,
        count: sql<number>`count(*)::int`,
      }).from(users).groupBy(users.role);

      const [totalComplaints] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints);
      const [totalWorkOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders);
      const [totalDocuments] = await db.select({ count: sql<number>`count(*)::int` }).from(documents);
      const [totalNotifications] = await db.select({ count: sql<number>`count(*)::int` }).from(notifications);

      res.json({
        success: true,
        stats: {
          totalUsers: totalUsers?.count || 0,
          roleCounts: Object.fromEntries(roleCounts.map(r => [r.role, r.count])),
          totalComplaints: totalComplaints?.count || 0,
          totalWorkOrders: totalWorkOrders?.count || 0,
          totalDocuments: totalDocuments?.count || 0,
          totalNotifications: totalNotifications?.count || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== STAFF FIELD VISIT ====================

  app.post("/api/staff/complaints/:complaintId/visit", requireRole("staff", "admin"), async (req: Request, res: Response) => {
    try {
      const { complaintId } = req.params;
      const sessionUser = (req as any).roleUser;
      const { action, notes, photos, latitude, longitude, verified } = req.body;

      const visitNote = action === "start" 
        ? `Field visit started by ${sessionUser.name}. ${notes || ""}`
        : action === "complete"
        ? `Field visit completed by ${sessionUser.name}. Verified: ${verified ? "Yes" : "No"}. ${notes || ""}`
        : `Field inspection note: ${notes || ""}`;

      await db.insert(complaintTimeline).values({
        complaintId,
        status: action === "complete" ? "in_progress" : "in_progress",
        note: visitNote,
      });

      if (action === "start") {
        await db.update(complaints).set({ status: "in_progress", updatedAt: new Date() })
          .where(eq(complaints.complaintId, complaintId));
      }

      await db.insert(auditLogs).values({
        userId: sessionUser.userId, action: `field_visit_${action}`, entityType: "complaint", entityId: complaintId,
        newValue: JSON.stringify({ notes, photos, latitude, longitude, verified }),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== AUTHORITY - ASSIGN CONTRACTOR TO WORK ORDER ====================

  app.post("/api/authority/work-orders/:workOrderId/assign", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { workOrderId } = req.params;
      const { contractorId } = req.body;
      const sessionUser = (req as any).roleUser;

      await db.update(workOrders).set({
        assignedContractorId: contractorId,
        status: "assigned",
        updatedAt: new Date(),
      }).where(eq(workOrders.workOrderId, workOrderId));

      await db.insert(auditLogs).values({
        userId: sessionUser.userId, action: "assign_contractor", entityType: "work_order", entityId: workOrderId,
        newValue: JSON.stringify({ contractorId }),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/authority/rate-contractor", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { contractorUserId, rating } = req.body;
      const sessionUser = (req as any).roleUser;
      
      await db.update(contractorProfiles).set({
        rating: String(Math.min(5, Math.max(0, rating))),
      }).where(eq(contractorProfiles.userId, contractorUserId));

      await db.insert(auditLogs).values({
        userId: sessionUser.userId, action: "rate_contractor", entityType: "contractor", entityId: contractorUserId,
        newValue: JSON.stringify({ rating }),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/authority/cluster-to-workorder", requireRole("authority", "head", "admin"), async (req: Request, res: Response) => {
    try {
      const { clusterId, title, description, department, category, priority, estimatedCost, assignedContractorId } = req.body;
      const sessionUser = (req as any).roleUser;

      const [cluster] = await db.select().from(complaintClusters).where(eq(complaintClusters.clusterId, clusterId)).limit(1);
      if (!cluster) return res.status(404).json({ success: false, message: "Cluster not found" });

      const workOrderId = generateWorkOrderId();
      const [wo] = await db.insert(workOrders).values({
        workOrderId,
        title: title || `Work Order for Cluster ${clusterId}`,
        description: description || `Auto-generated from complaint cluster ${clusterId}`,
        department: department || cluster.category,
        category: category || cluster.category,
        priority: priority || "high",
        status: assignedContractorId ? "assigned" : "created",
        assignedContractorId: assignedContractorId || null,
        clusterId: cluster.id,
        estimatedCost: estimatedCost || null,
        latitude: cluster.latitude,
        longitude: cluster.longitude,
      }).returning();

      await db.update(complaintClusters).set({
        workOrderId, status: "work_ordered", updatedAt: new Date(),
      }).where(eq(complaintClusters.clusterId, clusterId));

      const links = await db.select().from(complaintClusterLinks).where(eq(complaintClusterLinks.clusterId, clusterId));
      for (const link of links) {
        await db.update(complaints).set({ status: "work_ordered", updatedAt: new Date() })
          .where(eq(complaints.complaintId, link.complaintId));
        await db.insert(complaintTimeline).values({
          complaintId: link.complaintId, status: "work_ordered",
          note: `Clustered into work order ${workOrderId}`,
        });
      }

      await db.insert(auditLogs).values({
        userId: sessionUser.userId, action: "cluster_to_workorder", entityType: "work_order", entityId: workOrderId,
        newValue: JSON.stringify({ clusterId, complaintCount: links.length }),
      });

      res.json({ success: true, workOrder: wo });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== ADMIN - ANALYTICS & CONFIG ====================

  app.get("/api/admin/analytics", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const complaintTrend = await db.select({
        date: sql<string>`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
      }).from(complaints)
        .where(sql`${complaints.createdAt} > NOW() - INTERVAL '30 days'`)
        .groupBy(sql`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${complaints.createdAt}, 'YYYY-MM-DD')`);

      const departmentEfficiency = await db.select({
        department: complaints.assignedTo,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
        avgResolutionDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${complaints.updatedAt} - ${complaints.createdAt})) / 86400) FILTER (WHERE ${complaints.status} IN ('resolved','closed')), 0)::numeric(10,1)`,
        slaBreached: sql<number>`count(*) FILTER (WHERE ${complaints.slaDeadline} < NOW() AND ${complaints.status} NOT IN ('resolved','closed'))::int`,
      }).from(complaints)
        .where(sql`${complaints.assignedTo} IS NOT NULL`)
        .groupBy(complaints.assignedTo);

      const categoryAnalysis = await db.select({
        category: complaints.category,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) FILTER (WHERE ${complaints.status} IN ('resolved','closed'))::int`,
        pending: sql<number>`count(*) FILTER (WHERE ${complaints.status} NOT IN ('resolved','closed'))::int`,
      }).from(complaints)
        .groupBy(complaints.category)
        .orderBy(sql`count(*) DESC`)
        .limit(15);

      const loginActivity = await db.select({
        date: sql<string>`TO_CHAR(${auditLogs.createdAt}, 'YYYY-MM-DD')`,
        logins: sql<number>`count(*) FILTER (WHERE ${auditLogs.action} = 'login')::int`,
        actions: sql<number>`count(*)::int`,
      }).from(auditLogs)
        .where(sql`${auditLogs.createdAt} > NOW() - INTERVAL '14 days'`)
        .groupBy(sql`TO_CHAR(${auditLogs.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`TO_CHAR(${auditLogs.createdAt}, 'YYYY-MM-DD')`);

      const budgetAnalysis = await db.select({
        department: workOrders.department,
        estimated: sql<string>`COALESCE(SUM(${workOrders.estimatedCost}), 0)`,
        actual: sql<string>`COALESCE(SUM(${workOrders.actualCost}), 0)`,
        count: sql<number>`count(*)::int`,
      }).from(workOrders)
        .groupBy(workOrders.department);

      res.json({
        success: true,
        analytics: { complaintTrend, departmentEfficiency, categoryAnalysis, loginActivity, budgetAnalysis },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== ALL PROFILES (ADMIN DIRECTORY) ====================

  app.get("/api/admin/all-profiles", requireRole("admin", "head"), async (req: Request, res: Response) => {
    try {
      const staffList = await db.select().from(staffProfiles);
      const contractorList = await db.select().from(contractorProfiles);
      const profiles = [
        ...staffList.map(s => ({ ...s, profileType: "staff" as const })),
        ...contractorList.map(c => ({ ...c, profileType: "contractor" as const })),
      ];
      res.json({ success: true, profiles, staffProfiles: staffList, contractorProfiles: contractorList });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== SEED DEFAULT STAFF/CONTRACTOR/AUTHORITY ====================

  app.post("/api/admin/seed-roles", async (req: Request, res: Response) => {
    try {
      const departments = [
        "CSPDCL - Raipur Division", "Gas Authority - Chhattisgarh", "PHE Department - Raipur",
        "Municipal Corp - Sanitation Dept", "Municipal Corp - Engineering Dept", "General Administration",
      ];
      const specializations = ["Road & Bridges", "Drainage & Sewage", "Electrical Works", "Water Supply", "Building Construction", "Landscaping"];

      const existing = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(ne(users.role, "citizen"));
      if (existing[0]?.count > 0) {
        return res.json({ success: true, message: "Roles already seeded" });
      }

      for (let i = 0; i < 6; i++) {
        const [staffUser] = await db.insert(users).values({
          username: `staff${i + 1}`, password: `staff${i + 1}`, name: `Staff Member ${i + 1}`,
          phone: `900000000${i}`, role: "staff",
          suvidhaId: `STF-2025-${1000 + i}A`,
        }).returning();

        await db.insert(staffProfiles).values({
          userId: staffUser.id, department: departments[i], designation: "Field Officer",
          employeeId: `EMP-${1000 + i}`, ward: `Ward ${i + 1}`, phone: `900000000${i}`,
        });
      }

      for (let i = 0; i < 4; i++) {
        const [contractorUser] = await db.insert(users).values({
          username: `contractor${i + 1}`, password: `contractor${i + 1}`, name: `Contractor ${i + 1}`,
          phone: `800000000${i}`, role: "contractor",
          suvidhaId: `CNT-2025-${2000 + i}A`,
        }).returning();

        await db.insert(contractorProfiles).values({
          userId: contractorUser.id, companyName: `${["Raipur", "CG", "Bharat", "Mega"][i]} Construction`,
          contractorId: `CON-${2000 + i}`, specialization: specializations[i],
          licenseNumber: `LIC-CG-${3000 + i}`, phone: `800000000${i}`,
        });
      }

      const authorityDepartments = [
        { dept: "CSPDCL - Raipur Division", name: "Electricity Authority", username: "authority1", phone: "7000000000" },
        { dept: "Gas Authority - Chhattisgarh", name: "Gas Authority", username: "authority2", phone: "7000000002" },
        { dept: "PHE Department - Raipur", name: "Water Authority", username: "authority3", phone: "7000000003" },
        { dept: "Municipal Corp - Sanitation Dept", name: "Sanitation Authority", username: "authority4", phone: "7000000004" },
        { dept: "Municipal Corp - Engineering Dept", name: "Municipal Authority", username: "authority5", phone: "7000000005" },
      ];

      for (let i = 0; i < authorityDepartments.length; i++) {
        const ad = authorityDepartments[i];
        const [authUser] = await db.insert(users).values({
          username: ad.username, password: ad.username, name: ad.name,
          phone: ad.phone, role: "authority",
          suvidhaId: `AUTH-2025-${5000 + i}A`,
        }).returning();

        await db.insert(staffProfiles).values({
          userId: authUser.id, department: ad.dept, designation: "Department Head",
          employeeId: `DH-${5000 + i}`, ward: "All Wards", phone: ad.phone,
        });
      }

      const [headUser] = await db.insert(users).values({
        username: "head1", password: "head1", name: "District Collector",
        phone: "7000000001", role: "head",
        suvidhaId: "HEAD-2025-9500A",
      }).returning();

      const [adminUser] = await db.insert(users).values({
        username: "admin", password: "admin123", name: "System Administrator",
        phone: "7000000009", role: "admin",
        suvidhaId: "ADM-2025-9000A",
      }).returning();

      res.json({ success: true, message: "Roles seeded successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== TRANSPARENCY PUBLIC MAP ====================

  app.get("/api/public/transparency", async (req: Request, res: Response) => {
    try {
      const [totalComplaints] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints);
      const [resolvedComplaints] = await db.select({ count: sql<number>`count(*)::int` }).from(complaints)
        .where(or(eq(complaints.status, "resolved"), eq(complaints.status, "closed")));
      const [activeWorks] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders)
        .where(and(ne(workOrders.status, "completed"), ne(workOrders.status, "approved")));
      const [completedWorks] = await db.select({ count: sql<number>`count(*)::int` }).from(workOrders)
        .where(or(eq(workOrders.status, "completed"), eq(workOrders.status, "approved")));

      const publicComplaints = await db.select({
        category: complaints.category,
        status: complaints.status,
        latitude: complaints.latitude,
        longitude: complaints.longitude,
        locationAddress: complaints.locationAddress,
        createdAt: complaints.createdAt,
      }).from(complaints)
        .where(and(sql`${complaints.latitude} IS NOT NULL`, sql`${complaints.longitude} IS NOT NULL`))
        .limit(500);

      const publicWorks = await db.select({
        title: workOrders.title,
        status: workOrders.status,
        latitude: workOrders.latitude,
        longitude: workOrders.longitude,
        progressPercent: workOrders.progressPercent,
        category: workOrders.category,
      }).from(workOrders)
        .where(and(sql`${workOrders.latitude} IS NOT NULL`, sql`${workOrders.longitude} IS NOT NULL`));

      res.json({
        success: true,
        stats: {
          totalComplaints: totalComplaints?.count || 0,
          resolvedComplaints: resolvedComplaints?.count || 0,
          activeWorks: activeWorks?.count || 0,
          completedWorks: completedWorks?.count || 0,
          resolutionRate: totalComplaints?.count > 0 ? Math.round(((resolvedComplaints?.count || 0) / totalComplaints.count) * 100) : 0,
        },
        complaints: publicComplaints,
        workOrders: publicWorks,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
}
