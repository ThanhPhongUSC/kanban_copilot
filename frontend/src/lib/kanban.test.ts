import {
  cardMatchesFilter,
  collectAssignees,
  collectLabels,
  emptyFilter,
  isFilterActive,
  moveCard,
  type Card,
  type Column,
} from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

describe("card filtering", () => {
  const card: Card = {
    id: "card-1",
    title: "Design login page",
    details: "Add OAuth flow",
    priority: "high",
    dueDate: "2026-07-01",
    labels: ["design", "auth"],
    assignee: "alice",
  };

  it("matches everything with an empty filter", () => {
    expect(cardMatchesFilter(card, emptyFilter)).toBe(true);
  });

  it("matches on title and details text", () => {
    expect(cardMatchesFilter(card, { ...emptyFilter, text: "oauth" })).toBe(true);
    expect(cardMatchesFilter(card, { ...emptyFilter, text: "missing" })).toBe(false);
  });

  it("filters by priority, label, and assignee", () => {
    expect(cardMatchesFilter(card, { ...emptyFilter, priority: "high" })).toBe(true);
    expect(cardMatchesFilter(card, { ...emptyFilter, priority: "low" })).toBe(false);
    expect(cardMatchesFilter(card, { ...emptyFilter, label: "auth" })).toBe(true);
    expect(cardMatchesFilter(card, { ...emptyFilter, label: "other" })).toBe(false);
    expect(cardMatchesFilter(card, { ...emptyFilter, assignee: "alice" })).toBe(true);
    expect(cardMatchesFilter(card, { ...emptyFilter, assignee: "bob" })).toBe(false);
  });

  it("handles cards missing optional fields", () => {
    const bare: Card = { id: "x", title: "Bare", details: "" };
    expect(cardMatchesFilter(bare, { ...emptyFilter, label: "any" })).toBe(false);
    expect(cardMatchesFilter(bare, { ...emptyFilter, priority: "low" })).toBe(false);
  });

  it("detects active filters", () => {
    expect(isFilterActive(emptyFilter)).toBe(false);
    expect(isFilterActive({ ...emptyFilter, text: "x" })).toBe(true);
    expect(isFilterActive({ ...emptyFilter, priority: "high" })).toBe(true);
  });

  it("collects unique sorted labels and assignees", () => {
    const cards = {
      a: { id: "a", title: "", details: "", labels: ["b", "a"], assignee: "zoe" },
      b: { id: "b", title: "", details: "", labels: ["a"], assignee: "amy" },
      c: { id: "c", title: "", details: "" },
    };
    expect(collectLabels(cards)).toEqual(["a", "b"]);
    expect(collectAssignees(cards)).toEqual(["amy", "zoe"]);
  });
});
