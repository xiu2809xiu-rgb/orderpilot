import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeAll, describe, expect, it } from "vitest";
import { errorBody } from "@/test/fixtures";
import { server } from "@/test/server";
import { AiPanel } from "./AiPanel";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

const STATUS = "*/api/v1/ai/status";
const PROBE = "*/api/v1/ai/probe";

const MOCK = {
  provider: "mock",
  kind: "mock",
  model: "mock-extractor",
  mock: true,
};
const GEMINI = {
  provider: "gemini",
  kind: "openai-compatible",
  model: "gemini-2.5-flash",
  mock: false,
};

function status(data: object) {
  server.use(http.get(STATUS, () => HttpResponse.json({ data })));
}

function probeAnswers(extra: object) {
  server.use(
    http.post(PROBE, () =>
      HttpResponse.json({
        data: {
          ...GEMINI,
          outcome: "ok",
          reasonCode: null,
          latencyMs: 320,
          inputTokens: 18,
          outputTokens: 7,
          attempts: 1,
          ...extra,
        },
      }),
    ),
  );
}

const sendTest = () =>
  screen.getByRole("button", { name: "Send a test request" });

describe("the AI assistant section", () => {
  it("says the answers are scripted, with a Mock AI label, when the mock is in use", async () => {
    status(MOCK);
    renderSettings(<AiPanel />);
    expect(await screen.findByText("Mock AI")).toBeInTheDocument();
    expect(
      screen.getByText("Scripted sample answers. No real model is used."),
    ).toBeInTheDocument();
  });

  it("names a real provider and its model", async () => {
    status(GEMINI);
    renderSettings(<AiPanel />);
    expect(await screen.findByText("Google Gemini")).toBeInTheDocument();
    expect(screen.getByText("Model gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.queryByText("Mock AI")).toBeNull();
  });

  it("falls back to the provider's own name when it has no wording yet", async () => {
    status({ ...GEMINI, provider: "someone-new" });
    renderSettings(<AiPanel />);
    expect(await screen.findByText("someone-new")).toBeInTheDocument();
  });

  it("shows what the AI may see, in every state of the status", async () => {
    server.use(
      http.get(STATUS, () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-ai-0"), {
          status: 500,
        }),
      ),
    );
    renderSettings(<AiPanel />);
    expect(
      await screen.findByText(
        "Synthetic demo data only. No real customer or Spectra document is sent to an AI service.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the trace id of a failed status, and asks again on Try again", async () => {
    let calls = 0;
    server.use(
      http.get(STATUS, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-ai-1"), {
              status: 500,
            })
          : HttpResponse.json({ data: GEMINI });
      }),
    );
    renderSettings(<AiPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("trace-ai-1");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Google Gemini")).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

describe("the test of the connection", () => {
  it("is offered only to a role that manages settings", async () => {
    status(MOCK);
    const support = renderSettings(<AiPanel />, { role: "SUPPORT" });
    await screen.findByText("Mock AI");
    expect(
      screen.queryByRole("button", { name: "Send a test request" }),
    ).toBeNull();
    support.unmount();
    status(MOCK);
    renderSettings(<AiPanel />, { role: "SYSTEM_ADMIN" });
    await screen.findByText("Mock AI");
    expect(sendTest()).toBeEnabled();
  });

  it("reports how long the AI took and what it read and wrote", async () => {
    status(GEMINI);
    probeAnswers({});
    renderSettings(<AiPanel />, { role: "SYSTEM_ADMIN" });
    await screen.findByText("Google Gemini");
    await userEvent.click(sendTest());
    expect(
      await screen.findByText(
        "The AI answered in 320 ms. It read 18 tokens and wrote 7.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves the token figures out when there are none", async () => {
    status(GEMINI);
    probeAnswers({ inputTokens: null, outputTokens: null });
    renderSettings(<AiPanel />, { role: "SYSTEM_ADMIN" });
    await screen.findByText("Google Gemini");
    await userEvent.click(sendTest());
    expect(
      await screen.findByText("The AI answered in 320 ms."),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "error",
      "PROVIDER_ERROR",
      "The AI did not answer. Reason: PROVIDER_ERROR.",
    ],
    [
      "refused",
      "POLICY_REFUSED",
      "The request was refused before it was sent. Reason: POLICY_REFUSED.",
    ],
    ["timeout", "TIMEOUT", "The AI took too long to answer. Reason: TIMEOUT."],
  ])(
    "says what a %s outcome means, with its reason",
    async (outcome, code, words) => {
      status(GEMINI);
      probeAnswers({
        outcome,
        reasonCode: code,
        inputTokens: null,
        outputTokens: null,
        attempts: null,
      });
      renderSettings(<AiPanel />, { role: "SYSTEM_ADMIN" });
      await screen.findByText("Google Gemini");
      await userEvent.click(sendTest());
      expect(await screen.findByText(words)).toBeInTheDocument();
    },
  );

  it("gives the trace id when the test could not run, and the button stays the retry", async () => {
    status(GEMINI);
    server.use(
      http.post(PROBE, () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-ai-2"), {
          status: 500,
        }),
      ),
    );
    renderSettings(<AiPanel />, { role: "SYSTEM_ADMIN" });
    await screen.findByText("Google Gemini");
    await userEvent.click(sendTest());
    expect(
      await screen.findByText("The test could not run. Trace id trace-ai-2."),
    ).toBeInTheDocument();
    expect(sendTest()).toBeEnabled();
  });

  it("still shows the model when the test fails: the two are independent", async () => {
    status(GEMINI);
    server.use(
      http.post(PROBE, () =>
        HttpResponse.json(errorBody("INTERNAL_ERROR", "trace-ai-3"), {
          status: 500,
        }),
      ),
    );
    renderSettings(<AiPanel />, { role: "SYSTEM_ADMIN" });
    await screen.findByText("Google Gemini");
    await userEvent.click(sendTest());
    await screen.findByText(/trace-ai-3/);
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
  });
});
