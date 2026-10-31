import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LevelPills, TopicGrid } from "./topics";

describe("TopicGrid", () => {
  it("shows each topic with its count, zero when missing", () => {
    render(<TopicGrid keys={["saude", "educacao"]} counts={new Map([["saude", 12]])} active="" onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /Saúde/ })).toHaveTextContent("12");
    expect(screen.getByRole("button", { name: /Educação/ })).toHaveTextContent("0");
  });

  it("marks the active topic as pressed and reports picks", () => {
    const onPick = vi.fn();
    render(<TopicGrid keys={["saude", "educacao"]} counts={new Map()} active="educacao" onPick={onPick} />);
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
