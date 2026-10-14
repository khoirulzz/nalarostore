import { it, expect } from "vitest";
import { csv, dateRange } from "../worker/lib/operations";
it("escapes spreadsheet formulas, quotes and multiline customer input", () => {
  const result = csv(
    [
      {
        name: '=HYPERLINK("https://example.invalid")',
        phone: "+628123",
        note: 'baris 1\n"baris 2"',
      },
    ],
    ["name", "phone", "note"],
  );
  expect(result).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
  expect(result).toContain('"\' +628123"'.replace("' ", "'"));
  expect(result).toContain('"baris 1\n""baris 2"""');
});
it("rejects invalid, reversed and unbounded analytics ranges", () => {
  for (const query of [
    "from=bad",
    "from=2026-02-31",
    "from=2026-10-20&to=2026-10-10",
    "from=2020-01-01&to=2026-01-01",
  ])
    expect(() => dateRange(new URL("http://localhost/?" + query))).toThrow();
  expect(
    dateRange(new URL("http://localhost/?from=2026-10-01&to=2026-10-14")),
  ).toEqual({ from: "2026-10-01", to: "2026-10-14" });
});
