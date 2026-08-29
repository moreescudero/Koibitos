import { describe, expect, it } from "vitest";
import { buildRouteLegs, looksLikeUuid, validateAddInput } from "./tools";

describe("looksLikeUuid", () => {
  it("acepta uuids y rechaza texto suelto", () => {
    expect(looksLikeUuid("11111111-1111-1111-1111-111111111111")).toBe(true);
    expect(looksLikeUuid("Snoopy Museum")).toBe(false);
    expect(looksLikeUuid(123)).toBe(false);
  });
});

describe("validateAddInput", () => {
  it("normaliza un input válido", () => {
    expect(
      validateAddInput({
        city: "  Tokio ",
        category: "food",
        title: " Ramen ",
        description: "  ",
      }),
    ).toEqual({ city: "Tokio", category: "food", title: "Ramen", description: null });
  });

  it("rechaza categoría inválida y campos vacíos", () => {
    expect(() => validateAddInput({ city: "Tokio", category: "x", title: "y" })).toThrow(
      /category/,
    );
    expect(() => validateAddInput({ city: "", category: "note", title: "y" })).toThrow(
      /city/,
    );
    expect(() => validateAddInput({ city: "Tokio", category: "note", title: "" })).toThrow(
      /title/,
    );
  });
});

describe("buildRouteLegs", () => {
  it("agrega order_index correlativo y el tiempo de viaje real entre ciudades", () => {
    const legs = buildRouteLegs([
      { city: "Kioto", days_allocated: 3 },
      { city: "Osaka", days_allocated: 2, notes: "última parada" },
    ]);

    expect(legs[0]).toMatchObject({ order_index: 0, city: "Kioto", days_allocated: 3 });
    expect(legs[0].notes).toBeNull();
    expect(legs[1].order_index).toBe(1);
    expect(legs[1].notes).toContain("última parada");
    expect(legs[1].notes).toContain("30 min");
  });

  it("no rompe cuando no hay dato de viaje entre dos ciudades", () => {
    const legs = buildRouteLegs([
      { city: "Nagoya", days_allocated: 1 },
      { city: "Kobe", days_allocated: 1 },
    ]);
    expect(legs[1].notes).toBeNull();
  });

  it("rechaza legs vacío o días inválidos", () => {
    expect(() => buildRouteLegs([])).toThrow(/legs/);
    expect(() => buildRouteLegs("nope")).toThrow(/legs/);
    expect(() => buildRouteLegs([{ city: "Tokio", days_allocated: -1 }])).toThrow(
      /days_allocated/,
    );
  });
});
