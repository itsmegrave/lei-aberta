import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

describe("SiteFooter", () => {
  it("credits Lenindragons, the maker and the repository in new tabs", () => {
    render(<SiteFooter />);
    const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
    expect(href("Lenindragons")).toBe("https://linktr.ee/lenindragonsrpg");
    expect(href("itsmegrave")).toBe("https://github.com/itsmegrave");
    expect(href("GitHub")).toBe("https://github.com/itsmegrave/lei-aberta");
    for (const a of screen.getAllByRole("link")) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByText(/Mais um projeto vindo da comuna/)).toBeInTheDocument();
  });

  it("renders extra content passed by the page", () => {
    render(<SiteFooter><span>nota extra</span></SiteFooter>);
    expect(screen.getByText("nota extra")).toBeInTheDocument();
  });
});

describe("SiteNav", () => {
  it("links home, parties and sources", () => {
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Lei Aberta" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Partidos" })).toHaveAttribute("href", "/partidos");
    expect(screen.getByRole("link", { name: "Fontes" })).toHaveAttribute("href", "/#fontes");
  });
});
