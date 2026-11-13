import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import {
  AuditLink,
  ClassificationBadge,
  ConfidenceBadge,
  CopyButton,
  DemoBadge,
  EmptyState,
  ErrorPanel,
  formatRelative,
  LoadingState,
  MaskedValue,
  OperationLog,
  PageHeader,
  PartialNotice,
  PermissionDenied,
  RelativeTime,
  SectionCard,
  StatusBadge,
} from ".";

afterEach(() => {
  useSessionStore.setState({ status: "booting", session: null });
});

describe("badges", () => {
  it("says Mock, Mock AI and Synthetic demo data", () => {
    render(
      <>
        <DemoBadge kind="mock" />
        <DemoBadge kind="mockAi" />
        <DemoBadge kind="synthetic" />
      </>,
    );
    expect(screen.getByText("Mock")).toBeInTheDocument();
    expect(screen.getByText("Mock AI")).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
  });

  it("gives a status its words and an icon, not colour alone", () => {
    const { container } = render(
      <StatusBadge tone="warning">Waiting for approval</StatusBadge>,
    );
    expect(screen.getByText("Waiting for approval")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("names the classification level for assistive technology", () => {
    render(<ClassificationBadge level="restricted" />);
    expect(
      screen.getByLabelText("Classification: Restricted"),
    ).toBeInTheDocument();
  });
});

describe("MaskedValue", () => {
  it("never puts a hidden value in the page, and explains why on request", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MaskedValue
        value="000-000000-0"
        reason="bankDetails"
        visibleTo="Finance"
      />,
    );
    expect(container).not.toHaveTextContent("000-000000-0");
    expect(screen.getByLabelText("Hidden")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Why is this hidden?" }),
    );
    expect(
      await screen.findByText(/Bank details are hidden unless/),
    ).toBeInTheDocument();
    expect(screen.getByText("Who can see it: Finance")).toBeInTheDocument();
  });

  it("shows the value when it is not masked", () => {
    render(<MaskedValue masked={false} value="USD 4.35" />);
    expect(screen.getByText("USD 4.35")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Why is this hidden?" }),
    ).toBeNull();
  });
});

describe("ConfidenceBadge", () => {
  it("says Requires approval even at 99 percent", () => {
    render(<ConfidenceBadge confidence={0.99} />);
    expect(screen.getByText("Confidence 99%")).toBeInTheDocument();
    expect(screen.getByText("Requires approval")).toBeInTheDocument();
  });

  it("bands low scores and clears the notice once a person approved", () => {
    const { rerender } = render(<ConfidenceBadge confidence={0.42} />);
    expect(
      screen.getByText(/Confidence 42%/).closest("[data-band]"),
    ).toHaveAttribute("data-band", "low");
    rerender(<ConfidenceBadge confidence={0.42} approved />);
    expect(screen.queryByText("Requires approval")).toBeNull();
    expect(screen.getByText("Approved by a person")).toBeInTheDocument();
  });
});

describe("AuditLink", () => {
  function renderLink() {
    return render(
      <MemoryRouter>
        <AuditLink entity="order" id="o-1" subject="order SO-1" />
      </MemoryRouter>,
    );
  }

  it("links to the audit trail for people who may read it", () => {
    useSessionStore.getState().setSession(sessionFor("AUDITOR"));
    renderLink();
    const link = screen.getByRole("link", {
      name: "View audit trail for order SO-1",
    });
    expect(link).toHaveAttribute("href", "/audit?entity=order&id=o-1");
  });

  it("is absent for a role that cannot read the audit log", () => {
    useSessionStore.getState().setSession(sessionFor("WAREHOUSE"));
    renderLink();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("RelativeTime", () => {
  const now = new Date("2026-11-01T12:00:00Z");

  it("words a past and a future time", () => {
    expect(formatRelative(new Date("2026-11-01T11:55:00Z"), now)).toBe(
      "5 minutes ago",
    );
    expect(formatRelative(new Date("2026-11-03T12:00:00Z"), now)).toBe(
      "in 2 days",
    );
    expect(formatRelative(new Date("2026-10-31T12:00:00Z"), now)).toBe(
      "yesterday",
    );
    expect(formatRelative(now, now)).toBe("now");
  });

  it("keeps the exact time in the markup", () => {
    render(<RelativeTime value="2026-11-01T11:00:00Z" now={now} />);
    const time = screen.getByText("1 hour ago");
    expect(time).toHaveAttribute("datetime", "2026-11-01T11:00:00.000Z");
    expect(time).toHaveAttribute("title");
  });

  it("does not crash on a bad date", () => {
    render(<RelativeTime value="not a date" now={now} />);
    expect(screen.getByText("Unknown time")).toBeInTheDocument();
  });
});

describe("CopyButton", () => {
  it("copies the value and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    // user-event installs its own clipboard; spy on it after setup.
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
    render(<CopyButton value="trace-123" what="trace ID" />);
    await user.click(screen.getByRole("button", { name: "Copy trace ID" }));
    expect(writeText).toHaveBeenCalledWith("trace-123");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("says when the clipboard refuses", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    render(<CopyButton value="x" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument();
  });
});

describe("page layout and states", () => {
  it("lays out a header and a labelled section card", () => {
    render(
      <>
        <PageHeader title="Orders" description="All orders" />
        <SectionCard title="Lines" actions={<button type="button">Add</button>}>
          body
        </SectionCard>
      </>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Lines" });
    expect(within(card).getByRole("button", { name: "Add" })).toBeVisible();
  });

  it("announces loading once", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("empty offers the next action", () => {
    render(
      <EmptyState
        title="No orders yet"
        action={<button type="button">Upload</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No orders yet" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload" })).toBeVisible();
  });

  it("error shows words from the code, the trace id, and retries", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorPanel
        error={
          new ApiError("INTERNAL_ERROR", "raw server text", 500, "trace-9")
        }
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The server had a problem");
    expect(alert).not.toHaveTextContent("raw server text");
    expect(alert).toHaveTextContent("trace-9");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("partial says the data may be incomplete", () => {
    render(<PartialNotice />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Some of this is missing",
    );
  });

  it("permission denied is a plain statement", () => {
    render(<PermissionDenied />);
    expect(
      screen.getByRole("heading", { name: "You do not have access to this" }),
    ).toBeVisible();
  });

  it("has no accessibility violations across the pieces", async () => {
    useSessionStore.getState().setSession(sessionFor("AUDITOR"));
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Orders" meta={<DemoBadge kind="mock" />} />
        <SectionCard title="Details">
          <MaskedValue />
          <ConfidenceBadge confidence={0.8} />
          <ClassificationBadge level="internal" />
          <AuditLink entity="order" id="1" />
          <CopyButton value="x" what="reference" />
          <ErrorPanel error={new Error("x")} onRetry={() => undefined} />
          <PermissionDenied />
          <PartialNotice onRetry={() => undefined} />
          <EmptyState />
        </SectionCard>
      </MemoryRouter>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("OperationLog", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const rows = [
    {
      id: "1",
      at: "2026-11-01T11:00:00Z",
      user: "Priya Nair",
      ip: "192.0.2.10",
      change: "Changed the unit price from 4.20 to 4.35",
    },
  ];

  it("lists time, user, IP and what changed, and labels demo data", async () => {
    const { container } = render(<OperationLog rows={rows} demo now={now} />);
    const table = screen.getByRole("table");
    for (const name of ["Time", "User", "IP address", "What changed"]) {
      expect(
        within(table).getByRole("columnheader", { name }),
      ).toBeInTheDocument();
    }
    expect(within(table).getByText("1 hour ago")).toBeInTheDocument();
    expect(within(table).getByText("192.0.2.10")).toBeInTheDocument();
    expect(screen.getByText("Synthetic demo data")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("hides the demo label for real rows, and covers empty and loading", async () => {
    const { rerender } = render(<OperationLog rows={rows} now={now} />);
    expect(screen.queryByText("Synthetic demo data")).toBeNull();
    rerender(<OperationLog rows={[]} />);
    expect(screen.getByText("No changes recorded yet.")).toBeInTheDocument();
    rerender(<OperationLog rows={[]} loading />);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Loading");
    });
  });
});
