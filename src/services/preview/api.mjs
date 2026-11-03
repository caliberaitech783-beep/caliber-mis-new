import { createFixtures, sites, session } from "./fixtures.mjs";
const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Caliber-Preview": "synthetic",
    },
  });
const unavailable = (path) =>
  reply(
    {
      error:
        "LOCAL MOCK: " +
        path +
        " is not simulated. No production request was sent.",
    },
    501,
  );
// Explicit allowlist: unknown reads and mutations fail closed. Never call real fetch.
export function createPreviewApi({
  initialState = createFixtures(),
  save = () => {},
} = {}) {
  const state = structuredClone(initialState);
  const commit = (value) => {
    save(structuredClone(state));
    return reply(value);
  };
  const detail = (batch) => ({
    ...batch,
    records: state.records.filter((r) => r.data.vlbBatchId === batch.id),
    permissions: { manual: true, scan: true, edit: true },
    audit: [],
    requests: [],
    snapshot: [],
    holds: [],
    canLockVlb: batch.stage === "vlb_open",
    canClose: false,
    canEnterFleet: false,
  });
  return async function previewFetch(input, init = {}) {
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const url = new URL(
      typeof input === "string" ? input : input.url,
      "http://127.0.0.1:4176",
    );
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
      return unavailable("external connection");
    const path = decodeURIComponent(url.pathname),
      method = (init.method || input.method || "GET").toUpperCase(),
      read = method === "GET";
    let body = {};
    try {
      body = JSON.parse(init.body || "{}");
    } catch {
      return reply({ error: "LOCAL MOCK: invalid JSON." }, 400);
    }
    if (path === "/api/app-version")
      return reply({ environmentLabel: "", version: "synthetic-preview" });
    if (path === "/api/mis-sso/config") return reply({ mode: "off" });
    if (
      [
        "/api/session-heartbeat",
        "/api/logout",
        "/api/mis-credentials/logout",
      ].includes(path)
    )
      return reply({ ok: true, mocked: true });
    if (path === "/api/me/profile")
      return reply({
        name: session.name,
        location: sites[2],
        sites,
        ibossAccounts: false,
      });
    if (path === "/api/log-books/options")
      return reply({
        sites,
        assets: state.assets,
        employees: state.employees,
        shifts: state.shifts,
        workOrders: [],
        accountLocation: "",
        aliases: [],
      });
    if (path === "/api/log-books/employee-lookup") {
      const employee = state.employees.find((e) =>
        [e.caliberId, e.employeeCode].includes(
          String(body.caliberId).toUpperCase(),
        ),
      );
      return employee
        ? reply({
            ...employee,
            employeeId: employee.id,
            employeeName: employee.name,
          })
        : reply({ error: "No synthetic employee matches that ID." }, 404);
    }
    if (path === "/api/log-books/hours")
      return reply({
        breakdownHours: 0,
        availabilityHours: 8,
        runningHours: 8,
        idleHours: 0,
        warnings: [],
      });
    if (path === "/api/dashboard/log-books") {
      const selected = state.records.filter(
        (r) =>
          (!url.searchParams.get("location") ||
            r.data.location === url.searchParams.get("location")) &&
          r.data.bookDate >= (url.searchParams.get("from") || "") &&
          r.data.bookDate <= (url.searchParams.get("to") || "9999") &&
          (!url.searchParams.get("shift") ||
            url.searchParams.get("shift") === "S1"),
      );
      const bySite = sites
        .filter(
          (s) =>
            !url.searchParams.get("location") ||
            s === url.searchParams.get("location"),
        )
        .map((site) => ({
          site,
          vehicle: selected.filter(
            (r) => r.book_type === "vehicle" && r.data.location === site,
          ).length,
          equipment: selected.filter(
            (r) => r.book_type === "equipment" && r.data.location === site,
          ).length,
        }));
      return reply({
        sites,
        kinds: ["vehicle", "equipment"],
        updatedAt: new Date().toISOString(),
        totals: {
          vehicle: selected.filter((r) => r.book_type === "vehicle").length,
          equipment: selected.filter((r) => r.book_type === "equipment").length,
          activeSites: bySite.filter((s) => s.vehicle + s.equipment).length,
          recoveryDrafts: 0,
        },
        bySite,
        trend: [...new Set(selected.map((r) => r.data.bookDate))]
          .sort()
          .map((day) => ({
            day,
            date: day,
            vehicle: selected.filter(
              (r) => r.book_type === "vehicle" && r.data.bookDate === day,
            ).length,
            equipment: selected.filter(
              (r) => r.book_type === "equipment" && r.data.bookDate === day,
            ).length,
          })),
      });
    }
    if (path === "/api/dashboard/log-books/records")
      return reply({
        records: state.records
          .filter((r) => r.book_type === url.searchParams.get("kind"))
          .map((r) => ({
            ...r,
            site: r.data.location,
            day: r.data.bookDate,
            door: r.data.door,
          })),
        nextCursor: null,
      });
    if (path === "/api/requests") return reply([]);
    if (path === "/api/fleet-equipment")
      return reply({ equipment: state.assets, vehicles: state.assets, sites });
    if (path === "/api/employee-master") {
      if (read) {
        const q = (url.searchParams.get("q") || "").toLowerCase(),
          site = url.searchParams.get("site");
        const records = state.employees.filter(
          (e) =>
            (!site || e.locationName === site) &&
            JSON.stringify(e).toLowerCase().includes(q),
        );
        return reply({
          records,
          total: records.length,
          sites,
          page: 0,
          pageSize: 50,
        });
      }
      if (method === "POST") {
        if (!body.name?.trim() || !body.caliberId?.trim())
          return reply({ error: "Enter Employee ID and Employee Name." }, 422);
        const record = { ...body, id: crypto.randomUUID() };
        state.employees.push(record);
        return commit(record);
      }
    }
    if (path.startsWith("/api/employee-master/") && method === "PUT") {
      const index = state.employees.findIndex(
        (e) => e.id === path.split("/").at(-1),
      );
      if (index < 0)
        return reply({ error: "Synthetic employee not found." }, 404);
      state.employees[index] = { ...body, id: state.employees[index].id };
      return commit(state.employees[index]);
    }
    if (path === "/api/masters")
      return reply(
        Object.fromEntries(
          (url.searchParams.get("names") || "")
            .split("|")
            .map((name) => [name, state.masters[name] || []]),
        ),
      );
    if (path.startsWith("/api/masters/")) {
      const [, , , name, id] = path.split("/");
      const rows = (state.masters[name] ||= []);
      if (method === "POST" && !id) {
        if (!Array.isArray(body) || !body.length)
          return reply(
            { error: "Provide at least one synthetic record." },
            422,
          );
        const records = body.map((r) => ({ ...r, id: crypto.randomUUID() }));
        rows.push(...records);
        return commit({ records, added: records.length });
      }
      const index = rows.findIndex((r) => String(r.id) === id);
      if (index >= 0 && method === "PUT") {
        rows[index] = { ...rows[index], ...body };
        return commit(rows[index]);
      }
      if (index >= 0 && method === "DELETE") {
        rows.splice(index, 1);
        return commit({ deleted: true });
      }
    }
    if (path === "/api/capacity-master") {
      if (read)
        return reply({
          locations: sites,
          pairs: state.assets.map((a) => ({
            location: a.site,
            make: a.make,
            model: a.model,
          })),
          versions: state.capacities,
        });
      if (method === "POST") {
        if (
          !sites.includes(body.location) ||
          !body.make ||
          !body.model ||
          !(Number(body.capacity) > 0) ||
          !(Number(body.averageDalaFactor) > 0)
        )
          return reply(
            { error: "Select a fleet model and enter positive Dala Factors." },
            422,
          );
        const record = {
          ...body,
          id: crypto.randomUUID(),
          createdBy: "Local preview",
        };
        state.capacities.push(record);
        return commit(record);
      }
    }
    if (path === "/api/vlb-batches/approvals")
      return reply({ requests: [], approvals: [] });
    if (path === "/api/scan-backups" && read)
      return reply({ enabled: false, available: null, history: [] });
    if (path.startsWith("/api/erp-masters/") && read) {
      const name = path.slice("/api/erp-masters/".length),
        records =
          name === "Company master"
            ? [
                {
                  id: "local-company",
                  companyCode: "DEMO",
                  companyName: "Example Preview Company",
                  source: "Local",
                },
              ]
            : name === "Financial Year master"
              ? [
                  {
                    id: "local-year",
                    financialYearCode: "26-27",
                    financialYearBegin: "2026-04-01",
                    financialYearEnd: "2027-03-31",
                    source: "Local",
                  },
                ]
              : [];
      return reply({ records, status: { connected: false, lastSync: null } });
    }
    if (path === "/api/vlb-batches/preview")
      return reply({
        records: state.records.filter(
          (r) =>
            r.data.location === url.searchParams.get("site") &&
            r.data.bookDate === url.searchParams.get("date"),
        ),
      });
    if (path === "/api/vlb-batches") {
      if (read)
        return reply({
          batches: state.batches,
          openBatch: null,
          twoStage: true,
          actor: { admin: true, mis: true },
          pmApprovalTrial: { active: false },
          requests: [],
        });
      if (method === "POST") {
        if (!sites.includes(body.site) || !body.date || !body.shift)
          return reply({ error: "Select site, date and shift." }, 422);
        if (state.batches.some((b) => b.site === body.site && !b.closed_at))
          return reply(
            { error: "An open batch already exists for this site." },
            409,
          );
        const batch = {
          id: crypto.randomUUID(),
          name: "LOCAL/" + body.site + "/" + body.date + "/" + body.shift,
          site: body.site,
          report_date: body.date,
          shift: body.shift,
          twoStage: true,
          stage: "vlb_open",
          closed_at: null,
          card_count: 0,
        };
        state.batches.push(batch);
        return commit(detail(batch));
      }
    }
    if (path.startsWith("/api/vlb-batches/")) {
      const [, , , id, action] = path.split("/"),
        batch = state.batches.find((b) => b.id === id);
      if (batch && read && !action) return reply(detail(batch));
      if (batch && method === "POST" && action === "lock-vlb") {
        batch.stage = "elb_open";
        return commit(detail(batch));
      }
      if (batch && method === "POST" && action === "close") {
        batch.stage = "closed";
        batch.closed_at = new Date().toISOString();
        return commit(detail(batch));
      }
    }
    const book = /^\/api\/log-books\/(vehicle|equipment)(?:\/(\d+))?$/.exec(
      path,
    );
    if (book) {
      if (read)
        return reply({
          records: state.records.filter((r) => r.book_type === book[1]),
          nextCursor: null,
        });
      if (["POST", "PUT"].includes(method)) {
        if (!body.assetId || !body.employeeId || !body.bookDate)
          return reply(
            {
              error:
                "Complete the vehicle/equipment, employee and date fields.",
            },
            422,
          );
        const id = book[2]
          ? Number(book[2])
          : Math.max(0, ...state.records.map((r) => r.id)) + 1;
        const old = state.records.find((r) => r.id === id);
        if (old && body.revision !== old.revision)
          return reply({ error: "Record changed. Reload before saving." }, 409);
        const record = {
          id,
          book_no:
            old?.book_no ||
            "LOCAL/" +
              (book[1] === "vehicle" ? "VLB" : "ELB") +
              "/" +
              String(id).padStart(3, "0"),
          book_type: book[1],
          revision: (old?.revision || 0) + 1,
          data: { ...body, remark: body.remark || "Synthetic local preview" },
        };
        state.records = state.records.filter((r) => r.id !== id).concat(record);
        return commit(record);
      }
    }
    if (path === "/api/scan-batches")
      return read
        ? reply({ batches: [] })
        : unavailable("OCR, scanner and upload");
    if (path === "/api/equipment-aliases")
      return read
        ? reply({ aliases: [] })
        : unavailable("equipment alias approval");
    if (path === "/api/mis-admin/status")
      return reply({
        database: "Synthetic browser memory",
        connected: false,
        vlb: state.records.filter((r) => r.book_type === "vehicle").length,
        elb: state.records.filter((r) => r.book_type === "equipment").length,
        scans: 0,
        hotScanStorage: false,
      });
    if (path === "/api/backups") return reply({ history: [] });
    if (path === "/api/vlb-batch-deletions")
      return reply({ batches: [], deletions: [] });
    if (path === "/api/tickets") {
      if (read) return reply({ tickets: state.tickets });
      if (method === "POST") {
        if (!body.description?.trim())
          return reply({ error: "Describe the issue." }, 422);
        const ticket = {
          ...body,
          id: crypto.randomUUID(),
          status: "open",
          createdAt: new Date().toISOString(),
        };
        state.tickets.push(ticket);
        return commit(ticket);
      }
    }
    if (path === "/api/mis-ticket-sites") return reply({ sites });
    if (path === "/api/notifications")
      return reply({ notifications: [], unreadCount: 0 });
    if (path === "/api/user-sessions")
      return reply({ sessions: [], users: [] });
    if (path === "/api/audit-events") return reply({ events: [] });
    if (path === "/api/pulse-trip-verification")
      return reply({
        jobs: [],
        counts: { verified: 0, pending: 0, review: 0 },
        enabled: false,
        connected: false,
      });
    if (path === "/api/session-messages") return reply({ messages: [] });
    if (path === "/api/request-shifts") return reply({ shifts: state.shifts });
    if (path === "/api/announcements") return reply({ announcements: [] });
    return unavailable(path);
  };
}
