import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useForm, useWatch } from "react-hook-form";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { LineLastPrice } from "./LineLastPrice";
import type { OrderFormInput } from "./orderFormSchema";
import { blankOrder, type OrderForm } from "./orderFormValues";
import { fakeServer } from "./orderTestKit";

beforeAll(async () => {
  await i18n.loadNamespaces(["orders", "common"]);
});

const A = { number: "C-0001", name: "Quillon Harbour Traders" };
const B = { number: "C-0002", name: "Marlowe Bay Supplies" };

let form: OrderForm | null = null;

function Probe() {
  const f = useForm<OrderFormInput>({
    defaultValues: {
      ...blankOrder("2026-11-10"),
      customer: A,
      lines: [
        {
          lineId: "l1",
          item: { number: "I-0001", name: "Norvale Wireless Mouse" },
          description: "",
          quantity: "1",
          unitPrice: "",
          unit: "PCS",
          availableStock: null,
        },
      ],
    },
  }) as unknown as OrderForm;
  form = f;
  const shown = useWatch({ control: f.control, name: "lines.0.lastPrice" });
  return (
    <>
      <LineLastPrice form={f} priceMasked={false} paused={false} />
      <output aria-label="shown">
        {typeof shown === "object" && shown !== null
          ? shown.price
          : String(shown)}
      </output>
    </>
  );
}

describe("a customer swapped without passing through none", () => {
  it("drops the old customer's price before the new answer lands", async () => {
    let release: (price: string) => void = () => undefined;
    const held = new Promise<string>((resolve) => {
      release = resolve;
    });
    fakeServer({ lastPrice: (no) => (no === "C-0001" ? "17.90" : held) });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("shown")).toHaveTextContent("17.90");
    });
    // A draft restore or a script sets the customer in one step: there is no
    // moment with no customer for the effect to clear the line on.
    act(() => {
      form?.setValue("customer", B);
    });
    await waitFor(() => {
      expect(screen.getByLabelText("shown")).not.toHaveTextContent("17.90");
    });
    release("21.50");
    await waitFor(() => {
      expect(screen.getByLabelText("shown")).toHaveTextContent("21.50");
    });
  });
});
