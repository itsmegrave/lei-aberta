import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { law } from "@/test/fixtures";
import { PolicyCard } from "./policy-card";

describe("PolicyCard", () => {
  it("is a link to the law's own page with its topic, year, level and number", () => {
    render(<PolicyCard p={law()} index={0} onOpen={() => {}} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/lei/federal-lei-8080-1990");
    expect(screen.getByRole("heading", { name: "Lei Orgânica da Saúde" })).toBeInTheDocument();
    expect(link).toHaveTextContent("Saúde");
    expect(link).toHaveTextContent("1990");
    expect(link).toHaveTextContent("Federal");
    expect(link).toHaveTextContent("Lei 8.080");
    expect(link).toHaveTextContent("Cria o SUS.");
  });

  it("falls back to a generic topic for an unknown area", () => {
    render(<PolicyCard p={law({ areas: ["astronomia"] })} index={0} onOpen={() => {}} />);
    expect(screen.getByRole("link")).toHaveTextContent("astronomia");
  });

  it("a plain click opens the sheet instead of navigating", () => {
    const onOpen = vi.fn();
    render(<PolicyCard p={law()} index={0} onOpen={onOpen} />);
    expect(fireEvent.click(screen.getByRole("link"))).toBe(false);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("a modified click is left to the browser", () => {
    const onOpen = vi.fn();
    render(<PolicyCard p={law()} index={0} onOpen={onOpen} />);
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("click", stop);
    fireEvent.click(screen.getByRole("link"), { shiftKey: true });
    document.removeEventListener("click", stop);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
