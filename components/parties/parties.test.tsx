import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { spectrumColor, SPECTRUM_STOPS } from "@/lib/party-spectrum";
import { PartyYears } from "./party-years";
import { PartyDot, PositionBar, spectrumVars } from "./spectrum";

describe("spectrum", () => {
  it("spectrumVars carries both theme colors", () => {
    expect(spectrumVars(2.97)).toEqual({ "--pc": spectrumColor(2.97, "light"), "--pc-d": spectrumColor(2.97, "dark") });
    expect(spectrumVars(null)).toEqual({ "--pc": SPECTRUM_STOPS.light.none, "--pc-d": SPECTRUM_STOPS.dark.none });
  });

  it("PartyDot is decorative and colored by the party's score", () => {
    const { container } = render(<PartyDot party="PT" />);
    const dot = container.querySelector("i")!;
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot.style.getPropertyValue("--pc")).toBe(spectrumColor(2.97, "light"));
  });

  it("PositionBar places the marker on the 0-10 scale with a spoken label", () => {
    render(<PositionBar party="PT" />);
    const bar = screen.getByRole("img", { name: "Posição 2,97 numa escala de 0 (esquerda) a 10 (direita)" });
    expect(bar).toHaveTextContent("Esquerda");
    expect(bar).toHaveTextContent("2,97 de 10");
    expect(bar.querySelector("span[style]")!.getAttribute("style")).toContain("left: 29.7");
  });

  it("PositionBar compact hides the scale labels", () => {
    render(<PositionBar party="PT" compact />);
    expect(screen.getByRole("img")).not.toHaveTextContent("Esquerda");
  });

  it("PositionBar says so when the survey has no position", () => {
    render(<PositionBar party="União Brasil" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Sem posição na pesquisa de especialistas.")).toBeInTheDocument();
  });
});

describe("PartyYears", () => {
  const years = [
    { year: 2000, proposed: 2, signed: 0 },
    { year: 2001, proposed: 0, signed: 0 },
    { year: 2002, proposed: 4, signed: 1 },
  ];

  it("draws one strip per count, each on its own scale", () => {
    render(<PartyYears years={years} />);
    expect(screen.getByText("máx. 4 por ano")).toBeInTheDocument();
    expect(screen.getByText("máx. 1 por ano")).toBeInTheDocument();
    expect(screen.getAllByTitle("2002: 4 leis")).toHaveLength(1);
    expect(screen.getByText("2000")).toBeInTheDocument();
    expect(screen.getByText("2002")).toBeInTheDocument();
  });

  it("the table lists only years with laws", () => {
    render(<PartyYears years={years} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver como tabela" }));
    const rows = screen.getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows).toEqual(["200020", "200241"]);
  });
});
