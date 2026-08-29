import { describe, expect, it } from "vitest";
import { formatTravelTime, normalizeCity, travelTime } from "./routes";

describe("normalizeCity", () => {
  it("reconoce variantes de escritura y idioma", () => {
    expect(normalizeCity("Tokyo")).toBe("Tokio");
    expect(normalizeCity("  KYOTO ")).toBe("Kioto");
    expect(normalizeCity("shirakawa-go")).toBe("Shirakawa-go");
    expect(normalizeCity("Kawaguchiko")).toBe("Fujiyoshida");
  });

  it("devuelve null para ciudades desconocidas", () => {
    expect(normalizeCity("Nagoya")).toBeNull();
    expect(normalizeCity("")).toBeNull();
  });
});

describe("travelTime", () => {
  it("encuentra tramos conocidos en cualquier sentido", () => {
    expect(travelTime("Kioto", "Osaka")?.minutes).toBe(30);
    expect(travelTime("Osaka", "Kioto")?.minutes).toBe(30);
  });

  it("devuelve null para pares sin dato o iguales", () => {
    expect(travelTime("Tokio", "Tokio")).toBeNull();
    expect(travelTime("Hakone", "Nagoya")).toBeNull();
  });
});

describe("formatTravelTime", () => {
  it("arma un texto legible con duración y medio", () => {
    const s = formatTravelTime("Tokio", "Kioto");
    expect(s).toContain("2 h 20 min");
    expect(s).toContain("Shinkansen");
    expect(s).toContain("verificar");
  });

  it("devuelve null si no hay tramo", () => {
    expect(formatTravelTime("Tokio", "Nagoya")).toBeNull();
  });
});
