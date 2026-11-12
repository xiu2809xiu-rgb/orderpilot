import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  availableStockQuerySchema,
  availableStockResponseSchema,
  customerListSchema,
  customerQuerySchema,
  customerResponseSchema,
  itemListSchema,
  lastPricesQuerySchema,
  lastPricesResponseSchema,
  itemQuerySchema,
  itemResponseSchema,
  masterDataFiltersResponseSchema,
  navisionNoSchema,
  vendorListSchema,
  vendorQuerySchema,
  vendorResponseSchema,
  type AvailableStockQuery,
  type CustomerQuery,
  type ItemQuery,
  type LastPricesQuery,
  type VendorQuery,
} from "@orderpilot/shared";
import type { AuthContext } from "../../auth/auth-context.js";
import { Auth, RequirePermission } from "../../auth/decorators.js";
import { openApiQuery, openApiSchema } from "../../common/openapi.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import {
  MasterDataService,
  type MasterDataPage,
} from "./master-data.service.js";

const recordNo = new ZodValidationPipe(navisionNoSchema);

function pageOf<Row>(page: MasterDataPage<Row>) {
  return {
    data: page.items,
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      mock: true as const,
    },
  };
}

/** Read-only: Business Central stays the system of record, so nothing here writes. */
@ApiTags("MasterData")
@Controller("master-data")
@RequirePermission("orders.read")
export class MasterDataController {
  constructor(
    @Inject(MasterDataService) private readonly masterData: MasterDataService,
  ) {}

  @Get("filters")
  @ApiOperation({
    summary:
      "What the master data filters can offer. Mock Business Central data",
  })
  @ApiOkResponse({ schema: openApiSchema(masterDataFiltersResponseSchema) })
  async filters() {
    return {
      data: await this.masterData.filters(),
      meta: { mock: true as const },
    };
  }

  @Get("items")
  @ApiOperation({
    summary:
      "Items with their stock, a page at a time. Prices are masked by role. Mock Business Central data",
  })
  @openApiQuery(itemQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(itemListSchema) })
  async items(
    @Query(new ZodValidationPipe(itemQuerySchema)) query: ItemQuery,
    @Auth() auth: AuthContext,
  ) {
    return pageOf(await this.masterData.listItems(query, auth.user.role));
  }

  @Get("available-stock")
  @ApiOperation({
    summary:
      "The available stock of many items at once, for the lines of an order. Mock Business Central data",
  })
  @openApiQuery(availableStockQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(availableStockResponseSchema) })
  async availableStock(
    @Query(new ZodValidationPipe(availableStockQuerySchema))
    query: AvailableStockQuery,
  ) {
    return {
      data: await this.masterData.availableStock(query.itemNos.split(",")),
      meta: { mock: true as const },
    };
  }

  @Get("items/:no")
  @ApiParam({ name: "no", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "One item: its stock, open orders, open purchase orders and SPRs. Mock Business Central data",
  })
  @ApiOkResponse({ schema: openApiSchema(itemResponseSchema) })
  async item(@Param("no", recordNo) no: string, @Auth() auth: AuthContext) {
    return {
      data: await this.masterData.item(no, auth.user.role),
      meta: { mock: true as const },
    };
  }

  @Get("customers")
  @ApiOperation({
    summary:
      "Customers with their open and overdue orders, a page at a time. Mock Business Central data",
  })
  @openApiQuery(customerQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(customerListSchema) })
  async customers(
    @Query(new ZodValidationPipe(customerQuerySchema)) query: CustomerQuery,
  ) {
    return pageOf(await this.masterData.listCustomers(query));
  }

  @Get("customers/:no/last-prices")
  @ApiParam({ name: "no", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "What a customer last paid for each item asked for, as context for an order line. Masked like a unit price. Mock Business Central data",
  })
  @openApiQuery(lastPricesQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(lastPricesResponseSchema) })
  async lastPrices(
    @Param("no", recordNo) no: string,
    @Query(new ZodValidationPipe(lastPricesQuerySchema))
    query: LastPricesQuery,
    @Auth() auth: AuthContext,
  ) {
    return {
      data: await this.masterData.lastPrices(
        no,
        query.itemNos.split(","),
        auth.user.role,
      ),
      meta: { mock: true as const },
    };
  }

  @Get("customers/:no")
  @ApiParam({ name: "no", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "One customer: key facts, open orders and overdue orders. Mock Business Central data",
  })
  @ApiOkResponse({ schema: openApiSchema(customerResponseSchema) })
  async customer(@Param("no", recordNo) no: string, @Auth() auth: AuthContext) {
    return {
      data: await this.masterData.customer(no, auth.user.role),
      meta: { mock: true as const },
    };
  }

  @Get("vendors")
  @ApiOperation({
    summary:
      "Vendors, a page at a time. Balances are masked by role. Mock Business Central data",
  })
  @openApiQuery(vendorQuerySchema)
  @ApiOkResponse({ schema: openApiSchema(vendorListSchema) })
  async vendors(
    @Query(new ZodValidationPipe(vendorQuerySchema)) query: VendorQuery,
    @Auth() auth: AuthContext,
  ) {
    return pageOf(await this.masterData.listVendors(query, auth.user.role));
  }

  @Get("vendors/:no")
  @ApiParam({ name: "no", schema: { type: "string" } })
  @ApiOperation({
    summary:
      "One vendor: key facts, bank accounts masked by role, open purchase orders and items. Mock Business Central data",
  })
  @ApiOkResponse({ schema: openApiSchema(vendorResponseSchema) })
  async vendor(@Param("no", recordNo) no: string, @Auth() auth: AuthContext) {
    return {
      data: await this.masterData.vendor(no, auth.user.role),
      meta: { mock: true as const },
    };
  }
}
