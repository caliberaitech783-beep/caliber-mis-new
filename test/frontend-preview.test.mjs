import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewApi } from "../src/preview/api.mjs";
import { createFixtures, sites, date } from "../src/preview/fixtures.mjs";
import { previewGuard } from "../scripts/preview-guard.mjs";
const send = (api, path, body, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
test("preview blocks external requests and unsupported side effects", async () => {
  const api = createPreviewApi();
  for (const path of [
    "https://pulse-ll.cmll.in/api/requests",
    "/api/mis-admin/backup",
    "/api/mis-telegram/test",
    "/api/scan-batches",
  ]) {
    const response = await send(api, path, {});
    assert.equal(response.status, 501);
    assert.match((await response.json()).error, /LOCAL MOCK/);
  }
});
test("preview persists synthetic edits and rejects stale revisions", async () => {
  let saved;
  const api = createPreviewApi({
      save: (value) => {
        saved = value;
      },
    }),
    record = createFixtures().records[0];
  const response = await send(
    api,
    "/api/log-books/vehicle/1",
    { ...record.data, revision: 1, remark: "Changed locally" },
    "PUT",
  );
  assert.equal(response.status, 200);
  assert.equal(saved.records[0].data.remark, "Changed locally");
  assert.equal(
    (
      await send(
        api,
        "/api/log-books/vehicle/1",
        { ...record.data, revision: 1 },
        "PUT",
      )
    ).status,
    409,
  );
  const reloaded = createPreviewApi({ initialState: saved });
  assert.equal(
    (await (await reloaded("/api/log-books/vehicle")).json()).records[0]
      .revision,
    2,
  );
});
test("preview prevents a second open batch for the same site", async () => {
  const api = createPreviewApi();
  assert.equal(
    (await send(api, "/api/vlb-batches", { site: sites[2], date, shift: "S1" }))
      .status,
    409,
  );
  const created = await send(api, "/api/vlb-batches", {
    site: sites[0],
    date,
    shift: "S1",
  });
  assert.equal(created.status, 200);
  const batch = await created.json();
  assert.equal(batch.stage, "vlb_open");
  assert.deepEqual(batch.records, []);
});
test("preview dashboard filters synthetic data", async () => {
  const api = createPreviewApi();
  const read = async (site) =>
    await (
      await api(
        "/api/dashboard/log-books?from=2026-11-01&to=2026-11-03&location=" +
          encodeURIComponent(site),
      )
    ).json();
  assert.equal((await read(sites[2])).totals.vehicle, 1);
  assert.equal((await read(sites[0])).totals.vehicle, 0);
});
test("preview instances do not share mutations", async () => {
  const a = createPreviewApi(),
    b = createPreviewApi();
  await send(a, "/api/employee-master", {
    name: "Example New",
    caliberId: "CMLL900002",
  });
  assert.equal((await (await b("/api/employee-master")).json()).total, 1);
});
test("Vite preview API guard prevents requests reaching proxy middleware", () => {
  let handler;
  previewGuard().configureServer({
    middlewares: {
      use: (value) => {
        handler = value;
      },
    },
  });
  let next = false,
    body = "";
  const response = {
    setHeader() {},
    end: (value) => {
      body = value;
    },
  };
  handler({ url: "/api/mis-credentials/start" }, response, () => {
    next = true;
  });
  assert.equal(next, false);
  assert.equal(response.statusCode, 501);
  assert.match(body, /No backend/);
  handler({ url: "/src/main.jsx" }, response, () => {
    next = true;
  });
  assert.equal(next, true);
});

test("browser entry static imports exclude Node builtins", async () => {
  const { readFile } = await import("node:fs/promises");
  const { resolve, dirname, extname } = await import("node:path");
  const seen = new Set();
  async function visit(file, trail = []) {
    if (seen.has(file) || ![".js", ".mjs", ".jsx"].includes(extname(file)))
      return;
    seen.add(file);
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(
      /(?:from\s*|import\s*)['"]([^'"]+)['"]/g,
    )) {
      const specifier = match[1];
      assert.ok(
        !specifier.startsWith("node:"),
        [...trail, file, specifier].join(" -> "),
      );
      if (specifier.startsWith(".") && !specifier.includes("?"))
        await visit(resolve(dirname(file), specifier), [...trail, file]);
    }
  }
  await visit(resolve("src/main.jsx"));
});

test("synthetic trip fixture satisfies real equipment identity validation", async () => {
  const { validateTripEquipment } =
    await import("../trip-equipment-validation.mjs");
  const state = createFixtures();
  assert.deepEqual(
    validateTripEquipment(state.records[0].data, state.assets).issues,
    {},
  );
});
