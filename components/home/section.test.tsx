import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable, Section, useTableToggle } from "./section";

function setDesktop(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches, media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  window.location.hash = "";
});

describe("Section", () => {
  it("a plain section is a labelled heading with its content", () => {
    render(
      <Section id="s" title="Escolha um tema" lead="Toque em um tema.">
        <p>conteúdo</p>
      </Section>,
    );
    expect(screen.getByRole("region", { name: "Escolha um tema" })).toHaveTextContent("conteúdo");
    expect(screen.getByRole("heading", { level: 2, name: "Escolha um tema" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("on phones a collapsible section starts closed and toggles", () => {
    setDesktop(false);
    render(
      <Section id="s" title="Quando virou lei" collapsible note="2001">
        <p>gráfico</p>
      </Section>,
    );
    const toggle = screen.getByRole("button", { name: /Quando virou lei/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "s-body");
    expect(toggle).toHaveTextContent("2001");
    expect(document.getElementById("s-body")).toHaveAttribute("inert");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).not.toHaveTextContent("2001");
    expect(document.getElementById("s-body")).not.toHaveAttribute("inert");
  });

  it("on desktop a collapsible section is always open", () => {
    setDesktop(true);
    render(
      <Section id="s" title="Quem propôs" collapsible>
        <p>gráfico</p>
      </Section>,
    );
    const toggle = screen.getByRole("button", { name: /Quem propôs/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("a link to the section opens it", () => {
    setDesktop(false);
    window.location.hash = "#fontes";
    render(
      <Section id="fontes" title="Fontes" collapsible>
        <p>lista</p>
      </Section>,
    );
    expect(screen.getByRole("button", { name: /Fontes/ })).toHaveAttribute("aria-expanded", "true");
  });
});

describe("DataTable and useTableToggle", () => {
  it("renders headers and right-aligns numbers", () => {
    render(<DataTable head={["Partido", "Leis"]} rows={[["PT", 3], ["MDB", 10]]} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Partido", "Leis"]);
    expect(screen.getByRole("cell", { name: "10" })).toHaveClass("text-right");
    expect(screen.getByRole("cell", { name: "MDB" })).not.toHaveClass("text-right");
  });

  it("toggles between chart and table", () => {
    function Chart() {
      const { table, button } = useTableToggle();
      return (
        <>
          {table ? <span>tabela</span> : <span>gráfico</span>}
          {button}
        </>
      );
    }
    render(<Chart />);
    expect(screen.getByText("gráfico")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver como tabela" }));
    expect(screen.getByText("tabela")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver como gráfico" }));
    expect(screen.getByText("gráfico")).toBeInTheDocument();
  });
});
