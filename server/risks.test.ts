import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerRiskRoutes } from "./routes/risks";
import { storage } from "./storage";

type RouteHandler = (req: any, res: any) => Promise<void>;

function captureRiskHandlers() {
  const handlers = new Map<string, RouteHandler>();
  const app = {
    get() {},
    post(path: string, ...routeHandlers: RouteHandler[]) {
      handlers.set(`POST ${path}`, routeHandlers.at(-1)!);
    },
    patch(path: string, ...routeHandlers: RouteHandler[]) {
      handlers.set(`PATCH ${path}`, routeHandlers.at(-1)!);
    },
    delete() {},
  };

  registerRiskRoutes(app as any);
  return handlers;
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };
}

describe("RAID item routes", () => {
  it("preserves dependency type and fields when creating an item", async () => {
    const handlers = captureRiskHandlers();
    const handler = handlers.get("POST /api/timelines/:id/risks")!;
    const originalCreateRisk = storage.createRisk;
    let saved: any;

    storage.createRisk = async (data: any) => {
      saved = data;
      return { id: "dependency-1", ...data } as any;
    };

    try {
      const res = createResponse();
      await handler({
        tenantId: "tenant-1",
        params: { id: "timeline-1" },
        body: {
          title: "Client approval",
          itemType: "dependency",
          dependencySource: "Client",
          requiredByDate: "2026-09-01",
          raisedDate: "2026-08-20",
        },
      }, res);

      assert.equal(res.statusCode, 201);
      assert.equal(saved.itemType, "dependency");
      assert.equal(saved.dependencySource, "Client");
      assert.equal(saved.requiredByDate, "2026-09-01");
      assert.equal(saved.raisedDate, "2026-08-20");
      assert.equal(res.body.itemType, "dependency");
    } finally {
      storage.createRisk = originalCreateRisk;
    }
  });

  it("preserves a changed dependency type and fields when editing an item", async () => {
    const handlers = captureRiskHandlers();
    const handler = handlers.get("PATCH /api/risks/:id")!;
    const originalUpdateRisk = storage.updateRisk;
    let saved: any;

    storage.updateRisk = async (_id: string, _tenantId: string, data: any) => {
      saved = data;
      return { id: "item-1", ...data } as any;
    };

    try {
      const res = createResponse();
      await handler({
        tenantId: "tenant-1",
        params: { id: "item-1" },
        body: {
          itemType: "dependency",
          dependencySource: "Vendor",
          requiredByDate: "2026-09-15",
        },
      }, res);

      assert.equal(saved.itemType, "dependency");
      assert.equal(saved.dependencySource, "Vendor");
      assert.equal(saved.requiredByDate, "2026-09-15");
      assert.equal(res.body.itemType, "dependency");
    } finally {
      storage.updateRisk = originalUpdateRisk;
    }
  });
});