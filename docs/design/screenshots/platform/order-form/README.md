# New order form pictures

Taken on 20 Nov 2026 from a Docker build of this branch at commit fe9f215b, on the synthetic demo data.

The script signs in as Support and creates one draft order of its own, with a PO number that starts with SHOT-, to show that a blank last line does not block Save. It voids that draft again. It touches no other record.

| File                                   | Role and page                               | What it shows                                                                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| order-form-empty-light.png             | Support, /orders/new                        | The empty form at 1366 x 768 in light: one blank line, the Save bar under the top bar                                                                                                                                          |
| order-form-price-light.png             | Support, /orders/new                        | Two lines with an item chosen: the item cell shows the number and the whole name, each unit price is empty and says From the PO, and what the customer last paid sits beside it as context (No earlier price; Last USD 245.53) |
| order-form-sticky-light.png            | Support, /orders/new, scrolled              | The page scrolled by 300 px in light: the Save bar sits flush under the top bar and nothing shows through a gap beside it                                                                                                      |
| order-form-empty-dark.png              | Support, /orders/new                        | The empty form at 1366 x 768 in dark: one blank line, the Save bar under the top bar                                                                                                                                           |
| order-form-sticky-dark.png             | Support, /orders/new, scrolled              | The page scrolled by 300 px in dark: the Save bar sits flush under the top bar and nothing shows through a gap beside it                                                                                                       |
| order-form-date-light.png              | Support, /orders/new                        | A shipment date of 1 Jan 2020 on an order dated 20 Nov 2026, refused at the field with the next step                                                                                                                           |
| order-form-po-long-light.png           | Support, /orders/new                        | A PO number of 41 characters: nothing is cut, and the field says the limit (35) and the length                                                                                                                                 |
| order-form-messages-light.png          | Support, /orders/new                        | Save pressed with the form not ready: each message says what to do (nothing is saved)                                                                                                                                          |
| order-form-possible-customer-light.png | Support, /orders/new, customer lookup       | "Sagaran" finds C-0047 and, under the heading Possible matches, the look-alike Sagarun (C-0046), marked as a possible match and never chosen by Enter or Tab                                                                   |
| order-form-possible-none-light.png     | Support, /orders/new, customer lookup       | "Mer1dian" finds no record by its text: the lookup says so and offers the close names as possible matches                                                                                                                      |
| order-form-possible-item-light.png     | Support, /orders/new, item lookup           | "Monitr" in the item cell: close item names under Possible matches                                                                                                                                                             |
| order-form-tablet-light.png            | Support, /orders/new, 820 x 1180 with touch | Two lines at tablet width: each line takes two rows, the item and the description above, then quantity, price, amount and availability; labels are back and the controls are 44 px high                                        |
| order-form-blank-line-light.png        | Support, /orders/new                        | A line nobody touched below a finished one, before Save (PO number SHOT-MWOGR81Y, created by this script)                                                                                                                      |
| order-form-saved-light.png             | Support, /orders/SO-20261120-0001           | The draft after Save: the blank last line was not sent, 1 line(s) saved                                                                                                                                                        |

- light: after choosing I-0025 the price of line 1 is "" and its placeholder is "From the PO"
- light: after choosing I-0007 the price of line 2 is "" and its placeholder is "From the PO"
- light: the notes beside the prices say ["No earlier price","Last USD 245.53"]
- dark: after choosing I-0025 the price of line 1 is "" and its placeholder is "From the PO"
- dark: after choosing I-0007 the price of line 2 is "" and its placeholder is "From the PO"
- dark: the notes beside the prices say ["No earlier price","Last USD 245.53"]
- tablet: controls of a line under 44 px in a side: none
- saved SHOT-MWOGR81Y at /orders/SO-20261120-0001 with 1 line(s)
- voided SHOT-MWOGR81Y
