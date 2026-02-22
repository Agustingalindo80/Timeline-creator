import { storage } from "./storage";
import { db } from "./db";
import { timelines } from "@shared/schema";

export async function seedDatabase() {
  const existing = await db.select().from(timelines);
  if (existing.length > 0) return;

  const t1 = await storage.createTimeline({
    title: "Product Launch Roadmap",
    description: "Key milestones for our Q1 2025 product launch",
    color: "#2563eb",
  });

  const t1Milestones = [
    { title: "Market Research", date: "Jan 2025", description: "Competitive analysis and user interviews completed", sortOrder: 0 },
    { title: "Design Sprint", date: "Feb 2025", description: "UI/UX prototyping and user testing", sortOrder: 1 },
    { title: "Alpha Release", date: "Mar 2025", description: "Internal testing with core team", sortOrder: 2 },
    { title: "Beta Launch", date: "Apr 2025", description: "Public beta with early adopters", sortOrder: 3 },
    { title: "Official Launch", date: "May 2025", description: "Full product launch with marketing campaign", sortOrder: 4 },
  ];

  for (const m of t1Milestones) {
    await storage.createMilestone({ ...m, timelineId: t1.id, color: null, icon: null });
  }

  const t2 = await storage.createTimeline({
    title: "Company History",
    description: "Major events since founding",
    color: "#7c3aed",
  });

  const t2Milestones = [
    { title: "Founded", date: "2018", description: "Company incorporated in San Francisco", sortOrder: 0 },
    { title: "Seed Funding", date: "2019", description: "Raised $2M seed round", sortOrder: 1 },
    { title: "First 100 Customers", date: "2020", description: "Reached product-market fit", sortOrder: 2 },
    { title: "Series A", date: "2022", description: "Raised $15M Series A", sortOrder: 3 },
    { title: "Global Expansion", date: "2024", description: "Opened offices in London and Tokyo", sortOrder: 4 },
  ];

  for (const m of t2Milestones) {
    await storage.createMilestone({ ...m, timelineId: t2.id, color: null, icon: null });
  }

  const t3 = await storage.createTimeline({
    title: "Wedding Planning",
    description: "Checklist and plan for the big day",
    color: "#db2777",
  });

  const t3Milestones = [
    { title: "Venue Booked", date: "Jun 2025", description: "Riverside Gardens confirmed", sortOrder: 0 },
    { title: "Invitations Sent", date: "Aug 2025", description: "200 invitations mailed out", sortOrder: 1 },
    { title: "Catering Finalized", date: "Sep 2025", description: "Menu tasting completed", sortOrder: 2 },
    { title: "Rehearsal Dinner", date: "Nov 14, 2025", description: "Evening before the wedding", sortOrder: 3 },
    { title: "Wedding Day", date: "Nov 15, 2025", description: "The celebration begins!", sortOrder: 4 },
  ];

  for (const m of t3Milestones) {
    await storage.createMilestone({ ...m, timelineId: t3.id, color: null, icon: null });
  }

  console.log("Seed data inserted successfully");
}
