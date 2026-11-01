import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { law } from "@/test/fixtures";
import { LawMap } from "./law-map";

const strong = () => [...document.querySelectorAll("path[data-strong]")].map((p) => p.getAttribute("data-uf"));

describe("LawMap", () => {
  it("a federal law covers Brazil and marks its authors' states", () => {
    render(<LawMap p={law({ authors: [{ name: "A", kind: "deputy", party: "PT", uf: "SP" }, { name: "B", kind: "deputy", party: "PL", uf: "BA" }] })} />);
    expect(screen.getByText("Lei federal: vale em todo o Brasil.")).toBeInTheDocument();
    expect(screen.getByText(/Estados de quem propôs: São Paulo, Bahia/)).toBeInTheDocument();
    expect(strong().sort()).toEqual(["BA", "SP"]);
    expect(document.querySelectorAll("path")).toHaveLength(27);
  });

  it("a law from the executive has no author state", () => {
    render(<LawMap p={law()} />);
    expect(screen.queryByText(/quem propôs/)).toBeNull();
    expect(strong()).toEqual([]);
  });

  it("a state law highlights only its state", () => {
    render(<LawMap p={law({ id: "estadual-al-lei-9-2020", level: "estadual", jurisdiction: "Alagoas" })} />);
    expect(screen.getByText("Lei estadual: vale em Alagoas.")).toBeInTheDocument();
    expect(strong()).toEqual(["AL"]);
  });

  it("the drawing is hidden from screen readers; the sentence carries the meaning", () => {
    render(<LawMap p={law()} />);
    expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("figure")).toHaveTextContent("Onde vale");
  });
});
