import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LevelPills, TopicChips, TopicGrid } from "./topics";

describe("TopicGrid", () => {
  it("shows each topic with its count, zero when missing", () => {
    render(<TopicGrid keys={["saude", "educacao"]} counts={new Map([["saude", 12]])} href={(k) => `/busca?tema=${k}`} />);
    expect(screen.getByRole("link", { name: /Saúde/ })).toHaveTextContent("12");
    expect(screen.getByRole("link", { name: /Educação/ })).toHaveTextContent("0");
  });

  it("links each topic to its search results instead of filtering in place", () => {
    render(<TopicGrid keys={["saude", "educacao"]} counts={new Map()} href={(k) => `/busca?tema=${k}`} />);
    expect(screen.getByRole("link", { name: /Saúde/ })).toHaveAttribute("href", "/busca?tema=saude");
    expect(screen.getByRole("link", { name: /Educação/ })).toHaveAttribute("href", "/busca?tema=educacao");
  });
});

describe("TopicChips", () => {
  it("marks the active topic as pressed and reports picks", () => {
    const onPick = vi.fn();
    render(<TopicChips keys={["saude", "educacao"]} counts={new Map([["saude", 4]])} active="educacao" onPick={onPick} />);
    expect(screen.getByRole("button", { name: /Saúde/ })).toHaveTextContent("4");
    expect(screen.getByRole("button", { name: /Educação/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Saúde/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /Saúde/ }));
    expect(onPick).toHaveBeenCalledWith("saude");
  });
});

describe("LevelPills", () => {
  it("lists the three levels with counts and reports picks", () => {
    const onPick = vi.fn();
    render(<LevelPills counts={new Map([["federal", 3], ["municipal", 1]])} active="federal" onPick={onPick} />);
    const [federal, estadual, municipal] = screen.getAllByRole("button");
    expect(federal).toHaveTextContent("Federal3");
    expect(federal).toHaveAttribute("aria-pressed", "true");
    expect(estadual).toHaveTextContent("Estadual0");
    expect(municipal).toHaveTextContent("Municipal1");
    fireEvent.click(estadual);
    expect(onPick).toHaveBeenCalledWith("estadual");
  });
});
