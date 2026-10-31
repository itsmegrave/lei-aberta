import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pager } from "./pager";

const href = (n: number) => `?pagina=${n}`;

describe("Pager", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pager page={1} pages={1} href={href} onGo={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links every visible page and marks the current one", () => {
    render(<Pager page={5} pages={20} href={href} onGo={() => {}} />);
    expect(screen.getByRole("link", { name: "Página 5" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Página 4" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Página 1" })).toHaveAttribute("href", "?pagina=1");
    expect(screen.getByRole("link", { name: "Página 20" })).toHaveAttribute("href", "?pagina=20");
    expect(screen.queryByRole("link", { name: "Página 10" })).toBeNull();
    expect(screen.getByRole("link", { name: "Página anterior" })).toHaveAttribute("href", "?pagina=4");
    expect(screen.getByRole("link", { name: "Próxima página" })).toHaveAttribute("href", "?pagina=6");
    expect(screen.getByText("Página 5 de 20")).toBeInTheDocument();
  });

  it("has no previous link on the first page and no next link on the last", () => {
    const { rerender } = render(<Pager page={1} pages={3} href={href} onGo={() => {}} />);
    expect(screen.queryByRole("link", { name: "Página anterior" })).toBeNull();
    expect(screen.getByRole("link", { name: "Próxima página" })).toBeInTheDocument();
    rerender(<Pager page={3} pages={3} href={href} onGo={() => {}} />);
    expect(screen.queryByRole("link", { name: "Próxima página" })).toBeNull();
  });

  it("a plain click goes to the page without navigating", () => {
    const onGo = vi.fn();
    render(<Pager page={2} pages={5} href={href} onGo={onGo} />);
    const link = screen.getByRole("link", { name: "Página 3" });
    const notCancelled = fireEvent.click(link);
    expect(onGo).toHaveBeenCalledWith(3);
    expect(notCancelled).toBe(false);
  });

  it("Ctrl/Cmd-click is left to the browser (new tab)", () => {
    const onGo = vi.fn();
    render(<Pager page={2} pages={5} href={href} onGo={onGo} />);
    const defaultPrevented: boolean[] = [];
    // Stop jsdom from trying to follow the link once the component has had its say.
    const spy = (e: Event) => (defaultPrevented.push(e.defaultPrevented), e.preventDefault());
    document.addEventListener("click", spy);
    fireEvent.click(screen.getByRole("link", { name: "Página 3" }), { ctrlKey: true });
    fireEvent.click(screen.getByRole("link", { name: "Página 3" }), { metaKey: true });
    document.removeEventListener("click", spy);
    expect(onGo).not.toHaveBeenCalled();
    expect(defaultPrevented).toEqual([false, false]);
  });

  it("formats large page numbers in pt-BR", () => {
    render(<Pager page={1200} pages={1500} href={href} onGo={() => {}} />);
    expect(screen.getByText("Página 1.200 de 1.500")).toBeInTheDocument();
  });
});
