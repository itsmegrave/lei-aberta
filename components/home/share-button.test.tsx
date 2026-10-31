import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shortUrl } from "@/lib/share";
import { ShareButtons } from "./share-button";

const p = { id: "federal-lei-8080-1990", title: "Lei do SUS", summary: "Cria o SUS." };

function stubNavigator(over: Partial<Navigator>) {
  for (const [k, v] of Object.entries(over)) Object.defineProperty(navigator, k, { value: v, configurable: true });
}

afterEach(() => {
  for (const k of ["share", "clipboard"]) delete (navigator as unknown as Record<string, unknown>)[k];
  vi.useRealTimers();
});

describe("ShareButtons", () => {
  it("WhatsApp link carries the title, summary and short link", () => {
    render(<ShareButtons p={p} />);
    const wa = screen.getByRole("link", { name: /WhatsApp/ });
    const href = new URL(wa.getAttribute("href")!);
    expect(href.origin).toBe("https://wa.me");
    expect(href.searchParams.get("text")).toBe(`Lei do SUS: Cria o SUS. ${shortUrl(p.id)}`);
    expect(wa).toHaveAttribute("target", "_blank");
    expect(wa).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("prefers the card's own shareUrl", () => {
    render(<ShareButtons p={{ ...p, shareUrl: "https://example.org/l/abc1234" }} />);
    const text = new URL(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")!).searchParams.get("text");
    expect(text).toMatch(/ https:\/\/example\.org\/l\/abc1234$/);
  });

  it("uses the native share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stubNavigator({ share, clipboard: { writeText } as unknown as Clipboard });
    render(<ShareButtons p={p} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compartilhar" })));
    expect(share).toHaveBeenCalledWith({ title: "Lei do SUS", text: "Lei do SUS: Cria o SUS.", url: shortUrl(p.id) });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("does nothing more when the person closes the share sheet", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("closed"), { name: "AbortError" }));
    const writeText = vi.fn();
    stubNavigator({ share, clipboard: { writeText } as unknown as Clipboard });
    render(<ShareButtons p={p} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compartilhar" })));
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link without a share sheet, then resets the label", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
    render(<ShareButtons p={p} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compartilhar" })));
    expect(writeText).toHaveBeenCalledWith(shortUrl(p.id));
    expect(screen.getByRole("button", { name: "Link copiado" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2200));
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeInTheDocument();
  });

  it("falls back to a prompt when the clipboard is blocked", async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } as unknown as Clipboard });
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<ShareButtons p={p} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Compartilhar" })));
    expect(prompt).toHaveBeenCalledWith("Copie o link:", shortUrl(p.id));
  });
});
